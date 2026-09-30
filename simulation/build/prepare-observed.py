"""Turn Victoria's public traffic data into the model's traffic.

Inputs, in simulation/netlogo/data:
  observed/signals.csv            DTP list of traffic signal sites
  observed/cbd-detector-days.csv  SCATS detector counts for CBD sites that passed
                                  the quality checks (rebuilt from the monthly
                                  ZIP when it is present)
  map.txt                         the model's road map, made by prepare_map.py

Outputs:
  observed/demand.txt             NetLogo lists the model loads at Setup
  observed/summary.json           where the data came from, how it was used and
                                  how well the routes reproduce the counts; also
                                  copied to runtime/observed-data.json for the page

What it does, in order:
  1. Filter the raw month (only when the ZIP is present), keeping CBD rows that
     pass the quality checks.
  2. Match each signalised intersection in the DTP list to the map's junctions.
     Those junctions, and only those, get traffic lights in the model.
  3. Count the traffic entering each matched intersection in every 15 minutes
     of an average weekday and an average weekend day. SCATS counts every
     vehicle crossing a loop detector at the stop line, one detector per lane,
     so a site's detectors added together give the traffic entering it.
  4. Group the places where trips start and end: the real roads crossing the
     map's edge and the public car parks from OpenStreetMap.
  5. For every hour, estimate how many trips go from each of those places to
     each group, so that the model's own route choice reproduces the
     intersection counts as closely as possible. Within the hour, trips rise
     and fall with the 15-minute counts.

Run with:  npm run model:data   (add --retained-only to skip the ZIP)
"""

from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
import csv
import hashlib
import heapq
import io
import json
import math
import random
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "netlogo/data/observed"
MAP_FILE = ROOT / "netlogo/data/map.txt"
RUNTIME = ROOT / "runtime"

VERSION = "dtp-cbd-aug2026-v2"
GROUPS = ("weekday", "weekend")
SLOTS = 96

# The model's defaults, which its free-flow travel times and route choice
# depend on.
SPEED_LIMIT_KMH = 40
LITTLE_STREET_KMH = 20
ACCESS_KMH = 15
CYCLE_LENGTH = 80
EW_GREEN_SHARE = 50
INTERGREEN = 6
GIVE_WAY_DELAY = 6
ROUTE_NOISE = 0.1
BIG = 1e9

# Drivers add a little randomness at every junction, so each trip is routed
# this many times and the counts are shared between the routes.
ROUTE_SAMPLES = 8

# Rounds of adjustment for each hour.
PATTERN_ROUNDS = 40
TRIP_ROUNDS = 60

# The most trips an hour one place can send into the map: per lane of a main
# road crossing the edge (about what one lane passes through the next traffic
# light), per lane of a residential street (which gives way to the traffic it
# joins), and per driveway lane of a car park. These are assumptions; without
# them the fit could ask a small side street to carry an arterial's traffic.
ENTRY_LANE_CAPACITY = 900
MINOR_ENTRY_LANE_CAPACITY = 300
DRIVEWAY_CAPACITY = 300
MINOR_ROADS = {"unclassified", "residential", "living_street"}

# Trip ends are grouped by a 4 x 4 grid laid over the map's window.
HALF_WIDTH = 118.8
HALF_HEIGHT = 100.2
GRID = 4

# How closely a DTP site must sit to a junction to match it, in metres.
MATCH_METRES = 45

# Words dropped from street names before matching, so "La Trobe St" and
# "LATROBE" agree. "Lane" is kept: Flinders Lane is not Flinders Street.
STREET_WORDS = {
    "ST": "", "STREET": "", "RD": "", "ROAD": "", "AVE": "", "AVENUE": "",
    "PDE": "", "PARADE": "", "PL": "", "PLACE": "", "DR": "", "DRIVE": "",
    "WAY": "", "HWY": "", "HIGHWAY": "", "LN": "LANE", "STH": "SOUTH", "NTH": "NORTH",
}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def street_key(text):
    """A street name reduced for matching: "La Trobe St" and "LATROBE" both give "LATROBE"."""
    words = re.sub(r"[^A-Z ]", "", text.upper().replace("'", "")).split()
    kept = []
    for word in words:
        kept.append(STREET_WORDS.get(word, word))
    return "".join(kept)


def to_patches(latitude, longitude):
    """The same conversion prepare_map.py uses: 1 patch = 10 metres."""
    x = (longitude - 144.9635) * 11132 * math.cos(math.radians(-37.814))
    y = (latitude + 37.814) * 11132
    return x, y


def parse_netlogo(text):
    """Read NetLogo list syntax: numbers, strings and nested lists."""
    tokens = re.findall(r'\[|\]|"(?:[^"\\]|\\.)*"|[^\s\[\]]+', text)
    stack = [[]]
    for token in tokens:
        if token == "[":
            stack.append([])
        elif token == "]":
            finished = stack.pop()
            stack[-1].append(finished)
        elif token.startswith('"'):
            stack[-1].append(json.loads(token))
        else:
            stack[-1].append(float(token))
    return stack[0][0]


def to_netlogo(value):
    """Write a Python value as NetLogo list syntax."""
    if isinstance(value, list):
        return "[" + " ".join(to_netlogo(item) for item in value) + "]"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value)


# ---------------------------------------------------------------------------
#  1. Detector counts
# ---------------------------------------------------------------------------


def read_sites():
    """DTP signal sites inside the map's bounds."""
    with (DATA / "signals.csv").open(encoding="utf-8-sig") as stream:
        sites = []
        for row in csv.DictReader(stream):
            try:
                lat, lon = float(row["LATITUDE"]), float(row["LONGITUDE"])
            except ValueError:
                continue
            if -37.823 < lat < -37.805 and 144.950 < lon < 144.977:
                sites.append(row)
    return sites


def filter_raw_month(site_ids):
    """Rebuild cbd-detector-days.csv and quality-audit.json from the monthly ZIP."""
    archive = DATA / "scats-august-2026.zip"
    fields = ["site", "detector", "date"] + [f"v{i:02}" for i in range(96)]
    audit = Counter()
    retained = []
    with zipfile.ZipFile(archive) as bundle:
        for filename in sorted(bundle.namelist()):
            if not filename.lower().endswith(".csv"):
                continue
            with bundle.open(filename) as binary:
                reader = csv.DictReader(io.TextIOWrapper(binary, encoding="utf-8-sig"))
                for row in reader:
                    if row["NB_SCATS_SITE"] not in site_ids:
                        continue
                    audit["cbd_rows"] += 1
                    try:
                        values = [int(row[f"V{i:02}"]) for i in range(96)]
                        day = date.fromisoformat(row["QT_INTERVAL_COUNT"][:10])
                        valid = (int(row["CT_RECORDS"]) == 96 and int(row["CT_ALARM_24HOUR"]) == 0
                                 and min(values) >= 0 and max(values) <= 900
                                 and sum(values) > 0 and sum(values) == int(row["QT_VOLUME_24HOUR"]))
                    except (ValueError, KeyError):
                        audit["malformed_rows"] += 1
                        continue
                    if not valid:
                        audit["quality_rejected"] += 1
                        continue
                    retained.append([row["NB_SCATS_SITE"], row["NB_DETECTOR"], day.isoformat(), *values])
    # Reject conflicting duplicate records rather than counting them twice.
    keyed = defaultdict(list)
    for row in retained:
        keyed[tuple(row[:3])].append(row)
    clean = []
    for rows in keyed.values():
        if all(row == rows[0] for row in rows):
            clean.append(rows[0])
            audit["identical_duplicates_removed"] += len(rows) - 1
        else:
            audit["conflicting_duplicates_rejected"] += len(rows)
    clean.sort(key=lambda row: (row[2], int(row[0]), int(row[1])))
    with (DATA / "cbd-detector-days.csv").open("w", newline="") as out:
        writer = csv.writer(out)
        writer.writerow(fields)
        writer.writerows(clean)
    audit["quality_passed"] = len(clean)
    payload = dict(audit)
    payload["archive_sha256"] = digest(archive)
    (DATA / "quality-audit.json").write_text(json.dumps(payload, indent=2) + "\n")
    print("Filtered raw month:", dict(audit), flush=True)


def read_detector_days():
    """{(site, detector): {group: {date: [96 counts]}}} and the dates in each group."""
    days = {group: set() for group in GROUPS}
    detectors = defaultdict(lambda: {group: {} for group in GROUPS})
    with (DATA / "cbd-detector-days.csv").open() as stream:
        for row in csv.DictReader(stream):
            day = date.fromisoformat(row["date"])
            group = "weekday"
            if day.weekday() >= 5:
                group = "weekend"
            days[group].add(row["date"])
            detectors[(row["site"], row["detector"])][group][row["date"]] = [int(row[f"v{i:02}"]) for i in range(96)]
    return detectors, days


def site_counts(detectors, days):
    """Average traffic entering each site, in vehicles per hour, for every 15 minutes.

    A detector is used when it has valid counts on at least half the days of
    each group. A site is only used when every detector seen there passes, so
    a missing lane never makes a site look quieter than it is.
    """
    by_site = defaultdict(list)
    for site, detector in sorted(detectors, key=lambda key: (int(key[0]), int(key[1]))):
        by_site[site].append(detectors[(site, detector)])
    counts = {}
    for site, groups_list in by_site.items():
        usable = True
        for groups in groups_list:
            for group in GROUPS:
                if len(groups[group]) < math.ceil(0.5 * len(days[group])):
                    usable = False
        if not usable:
            continue
        counts[site] = {}
        for group in GROUPS:
            total = [0.0] * SLOTS
            for groups in groups_list:
                valid = groups[group]
                for slot in range(SLOTS):
                    total[slot] += 4 * sum(values[slot] for values in valid.values()) / len(valid)
            counts[site][group] = total
    return counts, {site: len(groups_list) for site, groups_list in by_site.items()}


# ---------------------------------------------------------------------------
#  2. The road network, as the model builds it
# ---------------------------------------------------------------------------


class Network:
    """The model's junctions, roads, entry points and car parks, with free-flow times."""

    def __init__(self, map_text):
        nodes, roads, edges, car_parks = [parse_netlogo(line) for line in map_text.splitlines()]
        self.points = [(row[1], row[2]) for row in nodes]
        self.kind = ["grid"] * len(nodes)
        self.streets = [set() for _ in nodes]
        self.links = []
        for row in roads:
            a, b, name = int(row[0]), int(row[1]), row[2]
            little = name.startswith("Little ") or name == "Flinders Ln"
            kind = "main"
            if little:
                kind = "little"
            self.add_link(a, b, kind, row[3], row[4], int(row[5]))
            self.streets[a].add(street_key(name))
            self.streets[b].add(street_key(name))
        self.map_nodes = len(nodes)

        # Zone points: the entry points first, then the car parks, in map order,
        # which is also the order the model creates them in.
        self.zones = []
        for row in edges:
            node = int(row[0])
            gate = self.add_node((row[1], row[2]), "gate")
            lanes_in, lanes_out = int(row[5]), int(row[6])
            if lanes_in > 0:
                self.add_link(gate, node, "gate", None, row[4], lanes_in)
            if lanes_out > 0:
                self.add_link(node, gate, "gate", None, row[4], lanes_out)
            per_lane = ENTRY_LANE_CAPACITY
            if row[7] in MINOR_ROADS:
                per_lane = MINOR_ENTRY_LANE_CAPACITY
            self.zones.append({"node": gate, "kind": "edge", "name": row[3], "point": (row[1], row[2]),
                               "start": lanes_in > 0, "end": lanes_out > 0, "size": lanes_in, "pull": lanes_out,
                               "capacity": per_lane * lanes_in})
        for row in car_parks:
            node = int(row[0])
            park = self.add_node((row[1], row[2]), "carpark")
            driveways = min(3, int(row[4]))
            self.add_link(park, node, "access", None, ACCESS_KMH, driveways)
            self.add_link(node, park, "access", None, ACCESS_KMH, driveways)
            self.zones.append({"node": park, "kind": "car park", "name": row[3], "point": (row[1], row[2]),
                               "start": True, "end": True, "size": int(row[4]), "pull": int(row[4]),
                               "capacity": DRIVEWAY_CAPACITY * driveways})

        self.outgoing = [[] for _ in self.points]
        self.incoming = [[] for _ in self.points]
        for index, link in enumerate(self.links):
            self.outgoing[link["from"]].append(index)
            self.incoming[link["to"]].append(index)
        # Signal site of each signalised junction; see use_signal_sites.
        self.site_of = {}
        self.signalised = set()

    def use_signal_sites(self, sites):
        """Put traffic lights at every junction of every site, one controller per site."""
        for index, nodes in enumerate(sites):
            for node in nodes:
                self.site_of[node] = index
                self.signalised.add(node)

    def within_site(self, index):
        """Whether a link runs between two junctions of the same signal site."""
        link = self.links[index]
        return link["from"] in self.site_of and self.site_of.get(link["to"]) == self.site_of[link["from"]]

    def add_node(self, point, kind):
        self.points.append(point)
        self.kind.append(kind)
        self.streets.append(set())
        return len(self.points) - 1

    def add_link(self, a, b, kind, length, speed, lanes):
        (ax, ay), (bx, by) = self.points[a], self.points[b]
        if length is None:
            length = math.dist((ax, ay), (bx, by)) * 10
        axis = "access"
        if kind != "access":
            axis = "NS"
            if abs(bx - ax) > abs(by - ay):
                axis = "EW"
        rank = 2
        if kind == "little":
            rank = 1
        elif kind == "access":
            rank = 0
        heading = math.degrees(math.atan2(bx - ax, by - ay)) % 360
        self.links.append({"from": a, "to": b, "kind": kind, "length": length, "speed": speed,
                           "lanes": lanes, "axis": axis, "rank": rank, "heading": heading})

    def free_time(self, index):
        """compute-free-tt in the model, at the model's default settings."""
        link = self.links[index]
        vmax = SPEED_LIMIT_KMH / 3.6
        if link["kind"] == "access":
            speed = ACCESS_KMH / 3.6
        elif link["kind"] == "little":
            speed = min(vmax, LITTLE_STREET_KMH / 3.6)
        else:
            speed = min(vmax, link["speed"] / 3.6)
        time = link["length"] / speed
        end = link["to"]
        if end in self.signalised and link["axis"] != "access" and not self.within_site(index):
            green_ew = (CYCLE_LENGTH - 2 * INTERGREEN) * EW_GREEN_SHARE / 100
            green = green_ew
            if link["axis"] != "EW":
                green = CYCLE_LENGTH - 2 * INTERGREEN - green_ew
            red = 1 - green / CYCLE_LENGTH
            time += red * red * CYCLE_LENGTH / 2
        if end not in self.signalised:
            for other in self.incoming[end]:
                if self.links[other]["rank"] > link["rank"]:
                    time += GIVE_WAY_DELAY
                    break
        return time


def turn_penalty(network, in_link, out_link):
    """turn-penalty in the model (hook turns are not used on the real map)."""
    before = network.links[in_link]["heading"]
    after = network.links[out_link]["heading"]
    angle = (after - before) % 360
    if angle >= 180:
        angle -= 360
    if abs(angle) < 30:
        return 0
    if abs(angle) > 150:
        return 90
    if angle > 0:
        return 10
    return 3


# ---------------------------------------------------------------------------
#  3. Matching signal sites to junctions
# ---------------------------------------------------------------------------


def match_sites(sites, network):
    """Intersection sites matched to the junctions they control.

    A junction matches when it lies within 45 m of the site and at least two
    of its street names appear in the site's name. Large intersections are
    drawn as several junctions in OpenStreetMap; all of them are kept.
    """
    matches = []
    for row in sites:
        if row["TYPE"] != "INT":
            continue
        x, y = to_patches(float(row["LATITUDE"]), float(row["LONGITUDE"]))
        names = {street_key(part) for part in re.split(r"/| AND | & ", row["SITE_NAME"].upper())}
        names.discard("")
        nodes = []
        for node in range(network.map_nodes):
            distance = math.dist(network.points[node], (x, y)) * 10
            if distance <= MATCH_METRES and len(names & network.streets[node]) >= 2:
                nodes.append((distance, node))
        if nodes:
            nodes.sort()
            matches.append({"site": row["SITE_NO"], "name": row["SITE_NAME"].strip(),
                            "nodes": sorted(node for distance, node in nodes),
                            "distanceMetres": round(nodes[0][0], 2)})
    return matches


# ---------------------------------------------------------------------------
#  4. Where trips start and end
# ---------------------------------------------------------------------------


def group_zones(network):
    """Give every zone point a group: the grid square it is in, edge or car park.

    Returns the groups that trips can end in, as lists of zone indices. A zone
    point's "group" is its index in that list, or -1 if nothing can end there.
    """
    keyed = defaultdict(list)
    for index, zone in enumerate(network.zones):
        x, y = zone["point"]
        column = min(GRID - 1, max(0, int((x + HALF_WIDTH) / (2 * HALF_WIDTH / GRID))))
        row = min(GRID - 1, max(0, int((y + HALF_HEIGHT) / (2 * HALF_HEIGHT / GRID))))
        keyed[(zone["kind"] != "edge", row, column)].append(index)
    groups = []
    for key in sorted(keyed):
        members = keyed[key]
        if any(network.zones[index]["end"] for index in members):
            for index in members:
                network.zones[index]["group"] = len(groups)
            groups.append(members)
        else:
            for index in members:
                network.zones[index]["group"] = -1
    return groups


def distances_to(network, seeds, times):
    """Travel time from every junction to the nearest seed, as compute-distances does.

    Like the model, routes never pass through an entry point or a car park.
    """
    distance = [BIG] * len(network.points)
    done = [False] * len(network.points)
    queue = []
    for seed in seeds:
        distance[seed] = 0
        heapq.heappush(queue, (0, seed))
    seed_set = set(seeds)
    while queue:
        current, node = heapq.heappop(queue)
        if done[node]:
            continue
        done[node] = True
        if node not in seed_set and network.kind[node] != "grid":
            continue
        for link in network.incoming[node]:
            before = network.links[link]["from"]
            candidate = current + times[link]
            if not done[before] and candidate < distance[before]:
                distance[before] = candidate
                heapq.heappush(queue, (candidate, before))
    return distance


def trace_route(network, start_link, members, distance, times, rng):
    """The links a driver takes to the nearest member, choosing like choose-from.

    At every junction the driver takes the road with the lowest travel time
    to the destination plus a turn penalty, each multiplied by a random factor
    between 1 and 1 + ROUTE_NOISE, exactly as the model's drivers do.
    """
    route = [start_link]
    current = start_link
    for _ in range(400):
        node = network.links[current]["to"]
        if node in members:
            return route
        back = network.links[current]["from"]
        options = []
        for link in network.outgoing[node]:
            end = network.links[link]["to"]
            if (network.kind[end] == "grid" or end in members) and distance[end] < BIG:
                options.append(link)
        forward = [link for link in options if network.links[link]["to"] != back]
        if forward:
            options = forward
        if not options:
            return None
        best = None
        for link in options:
            cost = times[link] + distance[network.links[link]["to"]] + turn_penalty(network, current, link)
            cost *= 1 + ROUTE_NOISE * rng.random()
            if best is None or cost < best[0]:
                best = (cost, link)
        current = best[1]
        route.append(current)
    return None


def approach_lanes(network, nodes):
    """Lanes entering a group of junctions from outside it, not counting car park exits."""
    inside = set(nodes)
    lanes = 0
    for node in inside:
        for link in network.incoming[node]:
            if network.links[link]["from"] not in inside and network.links[link]["kind"] != "access":
                lanes += network.links[link]["lanes"]
    return lanes




# ---------------------------------------------------------------------------
#  5. Estimating the trips
# ---------------------------------------------------------------------------


def route_volumes(routes, flows, sites):
    """Traffic entering each counted site when every route carries its trips.

    routes[origin] = [(group, ((site, share), ...))]: the counted sites a trip
    from that place to that group enters, with how often the sampled routes
    entered each one.
    """
    volumes = [0.0] * sites
    for origin_routes, origin_flows in zip(routes, flows):
        for (group, entered), flow in zip(origin_routes, origin_flows):
            for site, share in entered:
                volumes[site] += flow * share
    return volumes


def pattern_flows(routes, starts, pulls):
    """Trips on each route when every place's trips spread by the groups' pull."""
    flows = []
    for origin_routes, start in zip(routes, starts):
        total_pull = sum(pulls[group] for group, entered in origin_routes)
        if start == 0 or total_pull == 0:
            flows.append([0.0] * len(origin_routes))
        else:
            flows.append([start * pulls[group] / total_pull for group, entered in origin_routes])
    return flows


def adjust(counts, routes, flows, key_of):
    """One multiplicative (expectation-maximisation) update for counts.

    Trips are grouped by key_of(origin, group). Each group of trips is scaled
    by the average, over the counted sites its routes enter, of counted
    traffic divided by routed traffic. The update never makes a number
    negative, keeps the total routed traffic equal to the total counted, and
    leaves trips the counts say nothing about as they were. Returns the scale
    for each key.
    """
    volumes = route_volumes(routes, flows, len(counts))
    ratio = []
    for count, volume in zip(counts, volumes):
        if volume > 0:
            ratio.append(count / volume)
        else:
            ratio.append(1.0)
    top = defaultdict(float)
    bottom = defaultdict(float)
    for origin, (origin_routes, origin_flows) in enumerate(zip(routes, flows)):
        for (group, entered), flow in zip(origin_routes, origin_flows):
            if flow == 0:
                continue
            key = key_of(origin, group)
            for site, share in entered:
                top[key] += flow * share * ratio[site]
                bottom[key] += flow * share
    scale = {}
    for key in bottom:
        if bottom[key] > 0:
            scale[key] = top[key] / bottom[key]
    return scale


def fit_hour(counts, routes, starts, pulls, capacities):
    """Trips per hour on every route, fitted to one hour's counts.

    First the broad pattern: how many trips start at each place (starts) and
    how strongly each group attracts them (pulls). Both are changed in place,
    so the next hour can start from them. Then the trips from every place to
    every group are adjusted on their own, starting from that pattern. No
    place ever sends more trips than its capacity.
    """
    for _ in range(PATTERN_ROUNDS):
        flows = pattern_flows(routes, starts, pulls)
        for origin, value in adjust(counts, routes, flows, lambda origin, group: origin).items():
            starts[origin] = min(capacities[origin], starts[origin] * value)
        flows = pattern_flows(routes, starts, pulls)
        for group, value in adjust(counts, routes, flows, lambda origin, group: group).items():
            pulls[group] *= value
    flows = pattern_flows(routes, starts, pulls)
    for _ in range(TRIP_ROUNDS):
        scale = adjust(counts, routes, flows, lambda origin, group: (origin, group))
        for origin, origin_routes in enumerate(routes):
            for index, (group, entered) in enumerate(origin_routes):
                flows[origin][index] *= scale.get((origin, group), 1.0)
            total = sum(flows[origin])
            if total > capacities[origin]:
                flows[origin] = [flow * capacities[origin] / total for flow in flows[origin]]
    return flows


def geh(model, observed):
    """The GEH statistic traffic engineers use to compare hourly counts."""
    if model + observed == 0:
        return 0
    return math.sqrt(2 * (model - observed) ** 2 / (model + observed))


def main():
    sites = read_sites()
    site_ids = {row["SITE_NO"] for row in sites}
    archive = DATA / "scats-august-2026.zip"
    if archive.exists() and "--retained-only" not in sys.argv:
        filter_raw_month(site_ids)
    audit = json.loads((DATA / "quality-audit.json").read_text())
    detectors, days = read_detector_days()
    counts, detectors_per_site = site_counts(detectors, days)

    network = Network(MAP_FILE.read_text())
    matches = match_sites(sites, network)
    network.use_signal_sites([match["nodes"] for match in matches])
    # A site's count covers the whole intersection only when it has at least
    # one detector for every lane approaching it. Sites with fewer detectors
    # count only some approaches (often just the side street), so they get
    # traffic lights but are not used to shape or check the traffic.
    for match in matches:
        match["lanes"] = approach_lanes(network, match["nodes"])
        match["detectors"] = detectors_per_site.get(match["site"], 0)
        match["complete"] = match["site"] in counts and match["detectors"] >= match["lanes"]
    counted = [match for match in matches if match["complete"]]
    groups = group_zones(network)
    times = [network.free_time(index) for index in range(len(network.links))]

    # Which counted sites each trip enters: a route enters a site when it
    # crosses from a junction outside the site onto one of the site's junctions.
    site_of = {}
    for index, match in enumerate(counted):
        for node in match["nodes"]:
            site_of[node] = index
    start_link = {}
    for index, zone in enumerate(network.zones):
        for link in network.outgoing[zone["node"]]:
            start_link[index] = link
    origins = [index for index, zone in enumerate(network.zones) if zone["start"] and index in start_link]
    rng = random.Random(20260930)
    routes = [[] for _ in origins]
    route_count = 0
    for group, members in enumerate(groups):
        ends = [network.zones[index]["node"] for index in members if network.zones[index]["end"]]
        distance = distances_to(network, ends, times)
        end_set = set(ends)
        for position, origin in enumerate(origins):
            zone = network.zones[origin]
            if zone["group"] == group or distance[zone["node"]] >= BIG:
                continue
            entered = Counter()
            found = 0
            for _ in range(ROUTE_SAMPLES):
                route = trace_route(network, start_link[origin], end_set, distance, times, rng)
                if route is None:
                    continue
                found += 1
                for link in route:
                    to_site = site_of.get(network.links[link]["to"])
                    if to_site is not None and site_of.get(network.links[link]["from"]) != to_site:
                        entered[to_site] += 1
            if found:
                shares = tuple((site, entered[site] / found) for site in sorted(entered))
                routes[position].append((group, shares))
                route_count += 1

    capacities = [network.zones[origin]["capacity"] for origin in origins]
    trips = {}
    scales = {}
    fits = {}
    for group_name in GROUPS:
        starts = [float(network.zones[origin]["size"]) for origin in origins]
        pulls = [float(sum(network.zones[index]["pull"] for index in members)) for members in groups]
        trips[group_name] = []
        scales[group_name] = []
        fits[group_name] = []
        for hour in range(24):
            slots = range(hour * 4, hour * 4 + 4)
            hour_counts = [sum(counts[match["site"]][group_name][slot] for slot in slots) / 4 for match in counted]
            volumes = route_volumes(routes, pattern_flows(routes, starts, pulls), len(counted))
            starts = [min(capacity, value * sum(hour_counts) / max(1e-9, sum(volumes)))
                      for value, capacity in zip(starts, capacities)]
            flows = fit_hour(hour_counts, routes, starts, pulls, capacities)
            pulls = [pull / sum(pulls) for pull in pulls]

            # The model gets whole trips per hour for each place and group,
            # listing only the groups that place sends trips to.
            rows = [[] for _ in network.zones]
            for position, origin in enumerate(origins):
                for index, (group, entered) in enumerate(routes[position]):
                    flows[position][index] = round(flows[position][index])
                    if flows[position][index] > 0:
                        rows[origin].append([group, flows[position][index]])
            trips[group_name].append(rows)

            # Within the hour, trips follow the total counted in each 15 minutes.
            volumes = route_volumes(routes, flows, len(counted))
            for slot in slots:
                slot_counts = [counts[match["site"]][group_name][slot] for match in counted]
                factor = 1.0
                if sum(hour_counts) > 0:
                    factor = sum(slot_counts) / sum(hour_counts)
                scales[group_name].append(round(factor, 4))
                routed = [volume * factor for volume in volumes]
                fits[group_name].append({
                    "sites": len(slot_counts),
                    "withinGeh5": sum(1 for model, seen in zip(routed, slot_counts) if geh(model, seen) < 5),
                    "counted": round(sum(slot_counts)),
                    "routed": round(sum(routed)),
                    "trips": round(sum(sum(row) for row in flows) * factor),
                })

    signal_sites = [match["nodes"] for match in matches]
    site_rows = [[int(match["site"]), match["name"], match["nodes"]] for match in counted]
    count_rows = {}
    for group_name in GROUPS:
        count_rows[group_name] = [[round(counts[match["site"]][group_name][slot]) for match in counted]
                                  for slot in range(SLOTS)]
    zone_groups = [zone["group"] for zone in network.zones]
    lines = [
        to_netlogo(VERSION),
        to_netlogo(signal_sites),
        to_netlogo(site_rows),
        to_netlogo(count_rows["weekday"]),
        to_netlogo(count_rows["weekend"]),
        to_netlogo(zone_groups),
        to_netlogo(trips["weekday"]),
        to_netlogo(trips["weekend"]),
        to_netlogo(scales["weekday"]),
        to_netlogo(scales["weekend"]),
    ]
    (DATA / "demand.txt").write_text("\n".join(lines) + "\n")

    metadata = {
        "version": VERSION,
        "retrieved": "2026-09-30",
        "timezone": "Australia/Melbourne (AEST, UTC+10 in August)",
        "periodStart": min(day for group in days.values() for day in group),
        "periodEnd": max(day for group in days.values() for day in group),
        "source": "Department of Transport and Planning, Victoria",
        "licence": "CC BY 4.0",
        "countsUrl": "https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data",
        "signalsUrl": "https://opendata.transport.vic.gov.au/dataset/victorian-traffic-signals",
        "days": {group: len(values) for group, values in days.items()},
        "quality": audit,
        "inventorySitesInBounds": len(sites),
        "intersectionSitesInBounds": sum(1 for row in sites if row["TYPE"] == "INT"),
        "matchedSignalSites": len(matches),
        "signalJunctions": sum(len(nodes) for nodes in signal_sites),
        "countedSites": len(counted),
        "entryPoints": sum(1 for zone in network.zones if zone["kind"] == "edge"),
        "carParks": sum(1 for zone in network.zones if zone["kind"] == "car park"),
        "tripEndGroups": len(groups),
        "routes": route_count,
        "method": (
            "Signals: DTP intersection sites matched to map junctions within 45 m that share at least two street "
            "names; all junctions of one site share one controller and junctions without a matched site have no "
            "signals. Counts: for each matched site whose "
            "detectors all have valid days on at least half of the weekdays and weekend days, each detector's "
            "15-minute counts are averaged over its valid days, added across the site and converted to vehicles "
            "per hour. Only sites with at least one detector for every lane approaching them in the map are "
            "used, because other sites count only some approaches. Trips start at real roads crossing the map's "
            "edge and at OpenStreetMap public car parks, and end at the nearest place in a destination group "
            "(a 4 x 4 grid square; edge crossings and car parks separately). Routes follow the model's own route "
            "choice at its default settings, sampled 8 times per trip. For every hour, trips between every place "
            "and every group are scaled by the multiplicative (EM) update for counts, first as a pattern (trips "
            "starting at each place, pull of each group) and then pair by pair, until the routed traffic "
            "entering each counted site matches the SCATS counts as closely as possible. Trips are rounded to "
            "whole trips per hour. No main road crossing the edge sends more than 900 trips an hour per lane, no "
            "residential street more than 300 per lane, and no car park more than 300 per driveway lane (one lane "
            "per grouped car park, up to three). Within the hour, trips follow the 15-minute count totals."
        ),
        "filters": (
            "96 intervals, zero alarms, non-negative integer values, <=900 activations per interval, non-zero daily "
            "total matching supplied sum; conflicting duplicates excluded. Missing/zero-total days are excluded, "
            "not filled with zeros."
        ),
        "limitations": (
            "SCATS counts do not say which way vehicles travel or turn, so the trip pattern is one of many that "
            "reproduce the counts, not a measured origin-destination survey. Traffic light timings are not "
            "published in this data and remain assumed. Pedestrian crossings and unmatched sites have no signals. "
            "OpenStreetMap lane counts can be lower than the real ones. The month includes events and weather "
            "and has not been classified as incident-free."
        ),
        "fit": fits,
        "sites": [
            {"site": match["site"], "name": match["name"], "junctions": len(match["nodes"]),
             "detectors": match["detectors"], "approachLanes": match["lanes"], "counted": match["complete"],
             "distanceMetres": match["distanceMetres"]}
            for match in matches
        ],
        "dailyTotals": {group: [sum(row) for row in count_rows[group]] for group in GROUPS},
        "signalsSha256": digest(DATA / "signals.csv"),
        "retainedSha256": digest(DATA / "cbd-detector-days.csv"),
        "demandSha256": digest(DATA / "demand.txt"),
    }
    (DATA / "summary.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (RUNTIME / "observed-data.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print("Signals:", len(matches), "sites at", sum(len(nodes) for nodes in signal_sites), "junctions;", len(counted), "counted")
    print("Trip ends:", len(network.zones), "places in", len(groups), "groups;", route_count, "routes")
    for group_name in GROUPS:
        for slot in (32, 50, 70):
            row = fits[group_name][slot]
            print(group_name, slot // 4, "h: within GEH 5 at", row["withinGeh5"], "of", row["sites"],
                  "sites; counted", row["counted"], "routed", row["routed"], "trips/h", row["trips"])


if __name__ == "__main__":
    main()
