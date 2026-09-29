"""Build the compact road map that the traffic model loads.

This reads the raw OpenStreetMap extract in data/osm.xml and writes two files:

  data/map.txt           two NetLogo lists: the road junctions, then the roads
  data/map-summary.json  a short description of what was produced

What it does, in order:

  1. Convert every map point from latitude and longitude into model patches
     (1 patch = 10 metres), centred on the Melbourne CBD.
  2. Keep only the drivable street types inside the model's window.
  3. Keep only the largest group of roads where every road can reach every
     other road, so no car can get stuck on a disconnected piece.
  4. Merge chains of short segments into longer roads, but keep every shape
     point so roads still follow their real curves when drawn.

Run it from anywhere:  python3 packages/simulation/netlogo/tools/prepare_map.py
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

# Street types that cars may use in the model.
DRIVABLE_TYPES = {
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
    """Return every drivable road segment as {(from, to): (name, speed, lanes, type)}."""
    edges = {}
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
            if a not in inside or b not in inside or a == b:
                continue
            if math.dist(coordinates[a], coordinates[b]) < 0.05:
                continue
            name = short_name(tags.get("name", "Unnamed road"))
            forward = (name, speed, lane_count(tags, one_way, False), tags.get("highway"))
            edges[a, b] = forward
            if not one_way:
                edges[b, a] = (name, speed, lane_count(tags, one_way, True), forward[3])
    return edges


def largest_connected_group(edges):
    """Find the largest set of junctions where every junction can reach every other.

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

    return max(groups, key=len)


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

    edges = read_roads(root, coordinates, inside)

    keep = largest_connected_group(edges)
    connected = {}
    for pair, value in edges.items():
        if set(pair) <= keep:
            connected[pair] = value
    edges = connected

    forward = defaultdict(set)
    for a, b in edges:
        forward[a].add(b)

    anchors, neighbours = find_anchors(edges, forward)
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
    for (a, b), (attributes, path) in sorted(roads.items()):
        name, speed, lanes, road_type = attributes
        points = []
        for node in path:
            x, y = coordinates[node]
            points.append([round(x, 6), round(y, 6)])
        length = 0
        for p, q in zip(path, path[1:]):
            length += math.dist(coordinates[p], coordinates[q]) * 10
        road_rows.append([ids[a], ids[b], name, round(length, 6), speed, lanes, points])

    DATA_FOLDER.mkdir(exist_ok=True)
    (DATA_FOLDER / "map.txt").write_text(to_netlogo(node_rows) + "\n" + to_netlogo(road_rows) + "\n")
    summary = {
        "source": "OpenStreetMap contributors; ODbL",
        "downloaded": "2026-09-29",
        "nodes": len(used),
        "directed_links": len(road_rows),
        "preserved_geometry_points": sum(len(row[-1]) for row in road_rows),
    }
    (DATA_FOLDER / "map-summary.json").write_text(json.dumps(summary, indent=2))
    print(len(used), "nodes", len(road_rows), "links")


if __name__ == "__main__":
    main()
