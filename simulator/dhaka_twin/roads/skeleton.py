"""Offline fallback: Dhaka's main road corridors as a small graph.

Used when OpenStreetMap cannot be downloaded (CI, locked-down sandboxes).
Coordinates are approximate junction locations; corridors are densified into
~250 m segments so vehicles move smoothly. Run ``dhaka-twin fetch-graph`` on a
machine with internet access to get the full OSM drive network instead.
"""

from __future__ import annotations

import math

import numpy as np

from ..geo import haversine_m
from .graph import RoadGraph

# name: (lat, lng)
WAYPOINTS: dict[str, tuple[float, float]] = {
    # Airport Road / Dhaka-Mymensingh highway (north -> south)
    "abdullahpur": (23.8795, 90.4005),
    "house_building": (23.8680, 90.4005),
    "jashimuddin": (23.8615, 90.4003),
    "airport": (23.8515, 90.4080),
    "kawla": (23.8445, 90.4125),
    "khilkhet": (23.8290, 90.4195),
    "kuril": (23.8205, 90.4205),
    "shewra": (23.8155, 90.4150),
    "kakoli": (23.7955, 90.4015),
    "mohakhali": (23.7780, 90.4000),
    "jahangir_gate": (23.7705, 90.3960),
    "bijoy_sarani": (23.7640, 90.3890),
    "farmgate": (23.7580, 90.3890),
    "karwan_bazar": (23.7510, 90.3925),
    "bangla_motor": (23.7450, 90.3950),
    "shahbag": (23.7385, 90.3958),
    # Mirpur Road (Gabtoli -> Azimpur)
    "gabtoli": (23.7832, 90.3442),
    "technical": (23.7825, 90.3530),
    "kalyanpur": (23.7790, 90.3600),
    "shyamoli": (23.7745, 90.3650),
    "college_gate": (23.7662, 90.3690),
    "asad_gate": (23.7600, 90.3735),
    "dhanmondi_27": (23.7560, 90.3760),
    "russel_square": (23.7522, 90.3790),
    "kalabagan": (23.7470, 90.3810),
    "science_lab": (23.7387, 90.3835),
    "nilkhet": (23.7330, 90.3858),
    "azimpur": (23.7270, 90.3862),
    # Rokeya Sarani and Mirpur
    "mirpur_1": (23.7960, 90.3535),
    "mirpur_2": (23.8058, 90.3618),
    "mirpur_10": (23.8070, 90.3685),
    "mirpur_11": (23.8160, 90.3665),
    "mirpur_12": (23.8262, 90.3650),
    "pallabi": (23.8235, 90.3595),
    "kazipara": (23.7975, 90.3725),
    "shewrapara": (23.7905, 90.3755),
    "taltola": (23.7840, 90.3780),
    "agargaon": (23.7780, 90.3800),
    "sher_e_bangla_nagar": (23.7700, 90.3842),
    "mirpur_14": (23.7990, 90.3860),
    "kochukhet": (23.7920, 90.3900),
    "kalshi": (23.8250, 90.3790),
    "ecb_chattar": (23.8215, 90.3905),
    # Pragati Sarani (Kuril -> Rampura)
    "jamuna_future_park": (23.8135, 90.4235),
    "natun_bazar": (23.7975, 90.4235),
    "uttar_badda": (23.7850, 90.4262),
    "merul_badda": (23.7730, 90.4250),
    "rampura_bridge": (23.7650, 90.4232),
    "rampura": (23.7600, 90.4200),
    # Gulshan / Banani
    "banani_11": (23.7935, 90.4055),
    "gulshan_2": (23.7940, 90.4145),
    "gulshan_1": (23.7805, 90.4165),
    "police_plaza": (23.7730, 90.4140),
    "badda_link": (23.7800, 90.4262),
    # Tejgaon / Hatirjheel
    "tejgaon": (23.7640, 90.4000),
    "hatirjheel_west": (23.7545, 90.4000),
    "hatirjheel_mid": (23.7565, 90.4100),
    # Moghbazar / Malibagh / Paltan / Motijheel
    "moghbazar": (23.7490, 90.4045),
    "mouchak": (23.7465, 90.4125),
    "malibagh": (23.7488, 90.4168),
    "shantinagar": (23.7390, 90.4135),
    "kakrail": (23.7375, 90.4080),
    "matsya_bhaban": (23.7350, 90.4040),
    "paltan": (23.7330, 90.4125),
    "baitul_mukarram": (23.7297, 90.4127),
    "gulistan": (23.7240, 90.4120),
    "motijheel": (23.7275, 90.4205),
    "kamalapur": (23.7318, 90.4262),
    "basabo": (23.7400, 90.4300),
    "khilgaon": (23.7500, 90.4272),
    # Old Dhaka and the south-east
    "dhaka_university": (23.7335, 90.3955),
    "shahid_minar": (23.7270, 90.3990),
    "chankharpul": (23.7222, 90.4030),
    "bangshal": (23.7190, 90.4060),
    "nayabazar": (23.7155, 90.4060),
    "sadarghat": (23.7080, 90.4090),
    "chawkbazar": (23.7175, 90.3965),
    "lalbagh": (23.7190, 90.3880),
    "babubazar": (23.7120, 90.4000),
    "tikatuli": (23.7215, 90.4210),
    "sayedabad": (23.7150, 90.4270),
    "jatrabari": (23.7100, 90.4340),
    "shonir_akhra": (23.7035, 90.4450),
    # Dhanmondi / Mohammadpur
    "satmasjid_27": (23.7545, 90.3690),
    "dhanmondi_15": (23.7440, 90.3700),
    "jigatola": (23.7390, 90.3745),
    "panthapath": (23.7515, 90.3870),
    "mohammadpur": (23.7600, 90.3620),
    "bosila": (23.7550, 90.3500),
    "beribadh": (23.7700, 90.3450),
    # Uttara internal and Bashundhara
    "uttara_sector_11": (23.8720, 90.3900),
    "uttara_sector_4": (23.8640, 90.3920),
    "bashundhara_ra": (23.8185, 90.4330),
    "nsu": (23.8150, 90.4255),
    # Dhaka Elevated Expressway (separate deck; joins the ground only at ramps)
    "exp_kawla": (23.8440, 90.4118),
    "exp_kuril": (23.8210, 90.4180),
    "exp_banani": (23.7930, 90.4030),
    "exp_tejgaon": (23.7640, 90.3975),
    "exp_farmgate": (23.7575, 90.3912),
}

# (road class index, waypoint sequence); every corridor is two-way.
CORRIDORS: list[tuple[int, list[str]]] = [
    (1, ["abdullahpur", "house_building", "jashimuddin", "airport", "kawla", "khilkhet", "kuril", "shewra",
         "kakoli", "mohakhali", "jahangir_gate", "bijoy_sarani", "farmgate", "karwan_bazar", "bangla_motor",
         "shahbag"]),
    (2, ["gabtoli", "technical", "kalyanpur", "shyamoli", "college_gate", "asad_gate", "dhanmondi_27",
         "russel_square", "kalabagan", "science_lab", "nilkhet", "azimpur"]),
    (2, ["technical", "mirpur_1", "mirpur_2", "mirpur_10", "mirpur_11", "mirpur_12"]),
    (3, ["mirpur_12", "pallabi", "mirpur_2"]),
    (2, ["mirpur_10", "kazipara", "shewrapara", "taltola", "agargaon", "sher_e_bangla_nagar", "bijoy_sarani"]),
    (3, ["mirpur_10", "mirpur_14", "kochukhet", "kakoli"]),
    (3, ["mirpur_12", "kalshi", "ecb_chattar", "shewra"]),
    (3, ["mirpur_14", "ecb_chattar"]),
    (2, ["kuril", "jamuna_future_park", "natun_bazar", "uttar_badda", "badda_link", "merul_badda",
         "rampura_bridge", "rampura"]),
    (3, ["jamuna_future_park", "nsu", "bashundhara_ra"]),
    (3, ["kakoli", "banani_11", "gulshan_2", "natun_bazar"]),
    (3, ["mohakhali", "gulshan_1", "badda_link"]),
    (3, ["gulshan_1", "gulshan_2"]),
    (3, ["gulshan_1", "police_plaza", "hatirjheel_mid"]),
    (3, ["karwan_bazar", "hatirjheel_west", "hatirjheel_mid", "rampura"]),
    (3, ["mohakhali", "tejgaon", "hatirjheel_west"]),
    (3, ["bijoy_sarani", "tejgaon"]),
    (2, ["bangla_motor", "moghbazar", "mouchak", "malibagh", "rampura"]),
    (3, ["mouchak", "shantinagar", "kakrail", "matsya_bhaban", "shahbag"]),
    (3, ["shantinagar", "paltan", "baitul_mukarram", "gulistan"]),
    (3, ["paltan", "motijheel", "kamalapur", "basabo", "khilgaon", "malibagh"]),
    (3, ["khilgaon", "rampura"]),
    (3, ["baitul_mukarram", "motijheel"]),
    (3, ["shahbag", "dhaka_university", "shahid_minar", "chankharpul", "gulistan"]),
    (3, ["matsya_bhaban", "shahid_minar"]),
    (4, ["chankharpul", "bangshal", "nayabazar", "sadarghat"]),
    (4, ["azimpur", "lalbagh", "chawkbazar", "babubazar", "nayabazar"]),
    (4, ["chawkbazar", "chankharpul"]),
    (4, ["nilkhet", "dhaka_university"]),
    (3, ["gulistan", "tikatuli", "sayedabad", "jatrabari", "shonir_akhra"]),
    (3, ["motijheel", "tikatuli"]),
    (4, ["sadarghat", "tikatuli"]),
    (3, ["dhanmondi_27", "satmasjid_27", "dhanmondi_15", "jigatola", "science_lab"]),
    (3, ["russel_square", "panthapath", "karwan_bazar"]),
    (3, ["asad_gate", "mohammadpur", "bosila", "beribadh", "gabtoli"]),
    (4, ["mohammadpur", "satmasjid_27"]),
    (3, ["house_building", "uttara_sector_4", "uttara_sector_11", "abdullahpur"]),
    (4, ["jashimuddin", "uttara_sector_4"]),
    (4, ["farmgate", "panthapath"]),
    (4, ["college_gate", "sher_e_bangla_nagar"]),
    (4, ["jahangir_gate", "kochukhet"]),
    # Elevated expressway and its ramps
    (0, ["exp_kawla", "exp_kuril", "exp_banani", "exp_tejgaon", "exp_farmgate"]),
    (1, ["exp_kawla", "kawla"]),
    (1, ["exp_kuril", "kuril"]),
    (1, ["exp_banani", "kakoli"]),
    (1, ["exp_tejgaon", "tejgaon"]),
    (1, ["exp_farmgate", "farmgate"]),
]

SEGMENT_M = 250.0


def build_skeleton_graph() -> RoadGraph:
    lat: list[float] = []
    lng: list[float] = []
    ids: dict[str, int] = {}

    def node_for(name: str) -> int:
        if name not in ids:
            ids[name] = len(lat)
            la, ln = WAYPOINTS[name]
            lat.append(la)
            lng.append(ln)
        return ids[name]

    src: list[int] = []
    dst: list[int] = []
    length: list[float] = []
    cls: list[int] = []

    def add_two_way(a: int, b: int, road_class: int) -> None:
        d = haversine_m(lat[a], lng[a], lat[b], lng[b])
        for u, v in ((a, b), (b, a)):
            src.append(u)
            dst.append(v)
            length.append(d)
            cls.append(road_class)

    for road_class, names in CORRIDORS:
        for u_name, v_name in zip(names, names[1:]):
            u = node_for(u_name)
            v = node_for(v_name)
            d = haversine_m(lat[u], lng[u], lat[v], lng[v])
            pieces = max(1, math.ceil(d / SEGMENT_M))
            prev = u
            for k in range(1, pieces):
                f = k / pieces
                lat.append(lat[u] + (lat[v] - lat[u]) * f)
                lng.append(lng[u] + (lng[v] - lng[u]) * f)
                mid = len(lat) - 1
                add_two_way(prev, mid, road_class)
                prev = mid
            add_two_way(prev, v, road_class)

    graph = RoadGraph(
        np.array(lat),
        np.array(lng),
        np.array(src),
        np.array(dst),
        np.array(length),
        np.array(cls),
        source="skeleton",
    )
    return graph.largest_component()


def waypoint(name: str) -> tuple[float, float]:
    return WAYPOINTS[name]
