"""Build the compact road map that the traffic model loads.

This reads the raw OpenStreetMap extract in data/osm.xml and writes two files:

  data/map.txt           four NetLogo lists: the road junctions, the roads, the
                         places where roads cross the edge of the map, and the
                         public car parks
  data/map-summary.json  a short description of what was produced

What it does, in order:

  1. Convert every map point from latitude and longitude into model patches
     (1 patch = 10 metres), centred on the Melbourne CBD.
  2. Keep only the drivable street types inside the model's window, and note
     every road that crosses the window's edge. Traffic enters and leaves the
     model there.
  3. Keep only the roads that belong to one connected network: every road can
     be reached from the edge of the map and leads back to it, so no car can
     get stuck on a disconnected piece.
  4. Merge chains of short segments into longer roads, but keep every shape
     point so roads still follow their real curves when drawn.
  5. Attach each public car park (and car park entrance) to its nearest
     junction, grouping car parks that share a junction.

Run it from anywhere:  python3 simulation/netlogo/tools/prepare_map.py
"""

from collections import defaultdict
from pathlib import Path
import json
import math
import xml.etree.ElementTree as ElementTree


NETLOGO_FOLDER = Path(__file__).resolve().parent.parent
DATA_FOLDER = NETLOGO_FOLDER / "data"

# The map is centred on this point (roughly Elizabeth St and Bourke St).
CENTRE_LONGITUDE = 144.9635
CENTRE_LATITUDE = -37.814

# One degree of latitude is about 111,320 metres, which is 11,132 patches.
PATCHES_PER_DEGREE = 11132

# Half the width and height of the model's window, in patches.
HALF_WIDTH = 118.8
HALF_HEIGHT = 100.2

# Street types that cars may use in the model. King St and Wurundjeri Way are
# tagged "trunk" in OpenStreetMap.
DRIVABLE_TYPES = {
    "trunk",
    "trunk_link",
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "living_street",
}

# Access tags that mean ordinary cars are not allowed.
ACCESS_TAGS = ("access", "vehicle", "motor_vehicle", "motorcar")

# A stand-in junction for everything beyond the edge of the map. OpenStreetMap
# node numbers are all positive, so this can never clash with a real one.
OUTSIDE = -1

# The model's world runs from -120.5 to 120.5 across and -102.5 to 102.5 up
# and down. Entry points stay far enough inside that for cars drawn in their
# outer lanes (up to 1.4 patches to the side) to stay inside it too.
WORLD_HALF_WIDTH = 119.0
WORLD_HALF_HEIGHT = 101.0

# Street types from the most to the least important, for describing where a
# road crosses the edge of the map.
ROAD_CLASSES = [
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
]

# Kinds of off-street car park the public can drive into. Parking along the
# kerb or in a lane is not a trip destination in the model.
CAR_PARK_TYPES = {"multi-storey", "underground", "surface", "rooftop"}


def to_patches(node):
    """Convert one OpenStreetMap node into (x, y) model coordinates."""
    longitude = float(node.attrib["lon"])
    latitude = float(node.attrib["lat"])
    x = (longitude - CENTRE_LONGITUDE) * PATCHES_PER_DEGREE * math.cos(math.radians(CENTRE_LATITUDE))
    y = (latitude - CENTRE_LATITUDE) * PATCHES_PER_DEGREE
    return (x, y)


def short_name(name):
    """Shorten common street words, as the desktop model shows them."""
    return name.replace(" Street", " St").replace(" Lane", " Ln")


def lane_count(tags, one_way, reverse):
    """How many lanes a road has in one direction, between 1 and 4."""
    if reverse:
        key = "lanes:backward"
    else:
        key = "lanes:forward"

    if one_way:
        default_total = "1"
    else:
        default_total = "2"

    # A plain "lanes" tag on a two-way road counts both directions together.
    if key in tags or one_way:
        divisor = 1
    else:
        divisor = 2

    try:
        lanes = int(tags.get(key, tags.get("lanes", default_total))) // divisor
    except ValueError:
        return 1
    return max(1, min(4, lanes))


def read_roads(root, coordinates, inside):
    """Return every drivable road segment as {(from, to): (name, speed, lanes, type)}.

    Segments with both ends inside the window are roads. Segments with one end
    inside and one outside cross the window's edge; they are returned
    separately, in the same form, as the second result.
    """
    edges = {}
    crossings = {}
    for way in root.findall("way"):
        tags = {}
        for tag in way.findall("tag"):
            tags[tag.attrib["k"]] = tag.attrib["v"]

        if tags.get("highway") not in DRIVABLE_TYPES:
            continue
        blocked = False
        for key in ACCESS_TAGS:
            if tags.get(key) in ("no", "private"):
                blocked = True
        if blocked:
            continue

        node_ids = []
        for node in way.findall("nd"):
            node_ids.append(int(node.attrib["ref"]))

        if tags.get("junction") == "roundabout":
            default_direction = "yes"
        else:
            default_direction = "no"
        direction = tags.get("oneway", default_direction)
        if direction == "-1":
            node_ids.reverse()
        one_way = direction in ("yes", "1", "true", "-1")

        try:
            speed = float(tags.get("maxspeed", "40"))
        except ValueError:
            speed = 40

        for a, b in zip(node_ids, node_ids[1:]):
            if a == b or a not in coordinates or b not in coordinates:
                continue
            if a in inside and b in inside:
                target = edges
            elif a in inside or b in inside:
                target = crossings
            else:
                continue
            if math.dist(coordinates[a], coordinates[b]) < 0.05:
                continue
            name = short_name(tags.get("name", "Unnamed road"))
            forward = (name, speed, lane_count(tags, one_way, False), tags.get("highway"))
            target[a, b] = forward
            if not one_way:
                target[b, a] = (name, speed, lane_count(tags, one_way, True), forward[3])
    return edges, crossings


def strongly_connected_groups(edges):
    """Split the junctions into groups where every junction can reach every other.

    This is Kosaraju's algorithm, written without recursion so it copes with
    thousands of junctions.
    """
    forward = defaultdict(set)
    backward = defaultdict(set)
    for a, b in edges:
        forward[a].add(b)
        backward[b].add(a)

    # First pass: record the order in which junctions finish.
    seen = set()
    finish_order = []
    for start in sorted(set(forward) | set(backward)):
        stack = [(start, False)]
        while stack:
            node, finished = stack.pop()
            if finished:
                finish_order.append(node)
                continue
            if node in seen:
                continue
            seen.add(node)
            stack.append((node, True))
            for neighbour in sorted(forward[node]):
                if neighbour not in seen:
                    stack.append((neighbour, False))

    # Second pass: walk the reversed roads in reverse finish order.
    seen = set()
    groups = []
    for start in reversed(finish_order):
        if start in seen:
            continue
        stack = [start]
        seen.add(start)
        group = set()
        while stack:
            node = stack.pop()
            group.add(node)
            for neighbour in backward[node]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    stack.append(neighbour)
        groups.append(group)

    return groups


def connected_network(edges, crossings, inside):
    """The junctions of the one connected road network the model uses.

    Roads that cross the map's edge are joined to a stand-in junction for
    "outside the map", so a one-way road that only leads in, or only leads
    out, is kept. Every kept junction can reach every other one, either
    through the map or out over its edge and back in again. A piece that only
    touches the rest of the network through the edge is dropped.
    """
    links = dict(edges)
    for a, b in crossings:
        if a in inside:
            links[a, OUTSIDE] = crossings[a, b]
        else:
            links[OUTSIDE, b] = crossings[a, b]
    group = set()
    for candidate in strongly_connected_groups(links):
        if OUTSIDE in candidate:
            group = candidate
    group.discard(OUTSIDE)

    # Split what is left into pieces joined by roads inside the map, and keep
    # the largest piece.
    neighbours = defaultdict(set)
    for a, b in edges:
        if a in group and b in group:
            neighbours[a].add(b)
            neighbours[b].add(a)
    seen = set()
    largest = set()
    for start in sorted(group):
        if start in seen:
            continue
        piece = {start}
        stack = [start]
        seen.add(start)
        while stack:
            node = stack.pop()
            for neighbour in neighbours[node]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    piece.add(neighbour)
                    stack.append(neighbour)
        if len(piece) > len(largest):
            largest = piece
    return largest


def find_anchors(edges, forward):
    """Junctions where a road chain must start or stop.

    Anything that is not a simple pass-through point is an anchor, and so is
    any point where the road's name, speed, lanes or direction changes.
    """
    neighbours = defaultdict(set)
    for a, b in edges:
        neighbours[a].add(b)
        neighbours[b].add(a)

    anchors = set()
    for node, around in neighbours.items():
        if len(around) != 2:
            anchors.add(node)

    for node, around in neighbours.items():
        if len(around) == 2:
            b, c = sorted(around)
            if edges.get((b, node)) != edges.get((node, c)) or edges.get((c, node)) != edges.get((node, b)):
                anchors.add(node)
    return anchors, neighbours


def merge_chains(edges, forward, anchors, neighbours):
    """Join pass-through segments into single roads between anchors."""
    chains = []
    for start in sorted(anchors):
        for first_step in sorted(forward[start]):
            if (start, first_step) not in edges:
                continue
            path = [start, first_step]
            previous = start
            current = first_step
            while current not in anchors:
                following = None
                for candidate in neighbours[current]:
                    if candidate != previous:
                        following = candidate
                        break
                if (current, following) not in edges:
                    raise ValueError("Broken chain")
                path.append(following)
                previous, current = current, following
                if current == start:
                    break
            if start != current:
                chains.append((start, current, edges[start, first_step], path))
    return chains


def split_parallel_roads(chains, anchors):
    """NetLogo allows one road per direction between two junctions.

    When two different roads join the same pair of junctions, add a junction
    halfway along each so both roads survive.
    """
    counts = defaultdict(int)
    for a, b, attributes, path in chains:
        counts[a, b] += 1
    for a, b, attributes, path in chains:
        if counts[a, b] > 1 and len(path) > 2:
            anchors.add(path[len(path) // 2])


def cut_at_anchors(chains, anchors):
    """Cut every chain wherever it passes an anchor."""
    roads = {}
    for a, b, attributes, path in chains:
        piece = [path[0]]
        for node in path[1:]:
            piece.append(node)
            if node in anchors:
                roads[piece[0], node] = (attributes, piece)
                piece = [node]
    return roads


def edge_points(crossings, keep, coordinates):
    """Where roads cross the edge of the map, one entry per junction.

    Returns {junction: [street, speed, lanes in, lanes out, outward x, outward y,
    street type]} where the outward direction points from the junction towards
    the edge and the street type is the most important one crossing there.
    """
    points = {}
    for (a, b), (name, speed, lanes, road_type) in sorted(crossings.items()):
        if b in keep:
            node, outside, lanes_in, lanes_out = b, a, lanes, 0
        elif a in keep:
            node, outside, lanes_in, lanes_out = a, b, 0, lanes
        else:
            continue
        dx = coordinates[outside][0] - coordinates[node][0]
        dy = coordinates[outside][1] - coordinates[node][1]
        size = math.hypot(dx, dy)
        if node not in points:
            points[node] = [name, speed, 0, 0, 0.0, 0.0, road_type]
        point = points[node]
        point[1] = max(point[1], speed)
        if ROAD_CLASSES.index(road_type) < ROAD_CLASSES.index(point[6]):
            point[6] = road_type
        point[2] += lanes_in
        point[3] += lanes_out
        point[4] += dx / size
        point[5] += dy / size
    return points


def centre_of(node_ids, coordinates):
    """The average position of some map points, or None if none are known."""
    known = [coordinates[node] for node in node_ids if node in coordinates]
    if not known:
        return None
    return (sum(point[0] for point in known) / len(known), sum(point[1] for point in known) / len(known))


def read_car_parks(root, coordinates):
    """Public off-street car parks and car park entrances as [(x, y, name)].

    A car park drawn as an area is placed at the middle of its outline.
    """
    way_nodes = {}
    for way in root.findall("way"):
        way_nodes[way.attrib["id"]] = [int(node.attrib["ref"]) for node in way.findall("nd")]

    places = []
    for element in root:
        tags = {}
        for tag in element.findall("tag"):
            tags[tag.attrib["k"]] = tag.attrib["v"]
        amenity = tags.get("amenity")
        if amenity == "parking":
            if tags.get("parking", "surface") not in CAR_PARK_TYPES:
                continue
            if tags.get("access") in ("no", "private"):
                continue
        elif amenity != "parking_entrance" or tags.get("access") in ("no", "private"):
            continue

        if element.tag == "node":
            point = coordinates.get(int(element.attrib["id"]))
        elif element.tag == "way":
            point = centre_of(way_nodes[element.attrib["id"]][:-1] or way_nodes[element.attrib["id"]], coordinates)
        else:
            members = []
            for member in element.findall("member"):
                if member.attrib["type"] == "way" and member.attrib["ref"] in way_nodes:
                    members.extend(way_nodes[member.attrib["ref"]])
            point = centre_of(members, coordinates)
        if point is None:
            continue
        places.append((point[0], point[1], tags.get("name", "Car park")))
    return sorted(places)


def attach_car_parks(places, candidates, coordinates):
    """Join every car park to its nearest junction, grouping those that share one.

    Returns [[junction, x, y, name, count]] where (x, y) is the middle of the
    car parks in the group and name is the most common name among them.
    """
    groups = defaultdict(list)
    for x, y, name in places:
        if not (-HALF_WIDTH < x < HALF_WIDTH and -HALF_HEIGHT < y < HALF_HEIGHT):
            continue
        nearest = min(candidates, key=lambda node: (math.dist(coordinates[node], (x, y)), node))
        groups[nearest].append((x, y, name))
    result = []
    for node in sorted(groups):
        members = groups[node]
        names = defaultdict(int)
        for member in members:
            if member[2] != "Car park":
                names[member[2]] += 1
        name = "Car park"
        if names:
            name = min(names, key=lambda text: (-names[text], text))
        x = sum(member[0] for member in members) / len(members)
        y = sum(member[1] for member in members) / len(members)
        result.append([node, x, y, name, len(members)])
    return result


def to_netlogo(value):
    """Write a Python value as NetLogo list syntax."""
    if isinstance(value, list):
        parts = []
        for item in value:
            parts.append(to_netlogo(item))
        return "[" + " ".join(parts) + "]"
    if isinstance(value, str):
        return json.dumps(value)
    return str(value)


def main():
    root = ElementTree.parse(DATA_FOLDER / "osm.xml").getroot()

    coordinates = {}
    for node in root.findall("node"):
        coordinates[int(node.attrib["id"])] = to_patches(node)

    inside = set()
    for node_id, (x, y) in coordinates.items():
        if -HALF_WIDTH < x < HALF_WIDTH and -HALF_HEIGHT < y < HALF_HEIGHT:
            inside.add(node_id)

    edges, crossings = read_roads(root, coordinates, inside)

    keep = connected_network(edges, crossings, inside)
    connected = {}
    for pair, value in edges.items():
        if set(pair) <= keep:
            connected[pair] = value
    edges = connected

    forward = defaultdict(set)
    for a, b in edges:
        forward[a].add(b)

    edges_at = edge_points(crossings, keep, coordinates)
    anchors, neighbours = find_anchors(edges, forward)
    anchors.update(edges_at)
    chains = merge_chains(edges, forward, anchors, neighbours)
    split_parallel_roads(chains, anchors)
    roads = cut_at_anchors(chains, anchors)

    used = sorted({node for pair in roads for node in pair})
    node_rows = []
    for node in used:
        x, y = coordinates[node]
        node_rows.append([node, round(x, 6), round(y, 6)])

    road_rows = []
    ids = {}
    for index, node in enumerate(used):
        ids[node] = index
    road_types = defaultdict(set)
    for (a, b), (attributes, path) in sorted(roads.items()):
        name, speed, lanes, road_type = attributes
        road_types[a].add(road_type)
        road_types[b].add(road_type)
        points = []
        for node in path:
            x, y = coordinates[node]
            points.append([round(x, 6), round(y, 6)])
        length = 0
        for p, q in zip(path, path[1:]):
            length += math.dist(coordinates[p], coordinates[q]) * 10
        road_rows.append([ids[a], ids[b], name, round(length, 6), speed, lanes, points])

    # Each entry point sits two patches beyond its junction, towards the edge.
    edge_rows = []
    for node in sorted(edges_at):
        if node not in ids:
            continue
        name, speed, lanes_in, lanes_out, dx, dy, road_type = edges_at[node]
        size = max(0.001, math.hypot(dx, dy))
        x = min(WORLD_HALF_WIDTH, max(-WORLD_HALF_WIDTH, coordinates[node][0] + 2 * dx / size))
        y = min(WORLD_HALF_HEIGHT, max(-WORLD_HALF_HEIGHT, coordinates[node][1] + 2 * dy / size))
        edge_rows.append([ids[node], round(x, 6), round(y, 6), name, speed, lanes_in, lanes_out, road_type])

    # Car parks join ordinary streets, never the edge of the map or a
    # trunk road such as Wurundjeri Way.
    candidates = []
    for node in used:
        if node not in edges_at and not road_types[node] <= {"trunk", "trunk_link"}:
            candidates.append(node)
    car_park_rows = []
    for node, x, y, name, count in attach_car_parks(read_car_parks(root, coordinates), candidates, coordinates):
        car_park_rows.append([ids[node], round(x, 6), round(y, 6), name, count])

    DATA_FOLDER.mkdir(exist_ok=True)
    (DATA_FOLDER / "map.txt").write_text(
        to_netlogo(node_rows)
        + "\n"
        + to_netlogo(road_rows)
        + "\n"
        + to_netlogo(edge_rows)
        + "\n"
        + to_netlogo(car_park_rows)
        + "\n"
    )
    summary = {
        "source": "OpenStreetMap contributors; ODbL",
        "downloaded": "2026-09-29",
        "nodes": len(used),
        "directed_links": len(road_rows),
        "preserved_geometry_points": sum(len(row[6]) for row in road_rows),
        "edge_entry_points": len(edge_rows),
        "car_park_groups": len(car_park_rows),
        "car_parks_and_entrances": sum(row[4] for row in car_park_rows),
    }
    (DATA_FOLDER / "map-summary.json").write_text(json.dumps(summary, indent=2))
    print(len(used), "nodes", len(road_rows), "links", len(edge_rows), "edge points", len(car_park_rows), "car park groups")


if __name__ == "__main__":
    main()
