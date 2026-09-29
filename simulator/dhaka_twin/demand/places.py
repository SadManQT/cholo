"""Points of interest that shape where Dhaka's trips start and end.

Each place spreads a Gaussian kernel of weight over nearby H3 cells. Weights
are relative within a category. Coordinates are approximate.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Place:
    name: str
    category: str
    lat: float
    lng: float
    weight: float = 1.0
    radius_m: float = 900.0


CATEGORIES = (
    "residential",
    "office",
    "retail",
    "education",
    "hospital",
    "terminal",
    "airport",
    "mosque",
    "leisure",
    "stadium",
)

PLACES: list[Place] = [
    # Residential neighbourhoods
    Place("Mirpur 1-2", "residential", 23.8000, 90.3560, 1.0, 1400),
    Place("Mirpur 10-12", "residential", 23.8160, 90.3680, 1.0, 1400),
    Place("Pallabi", "residential", 23.8250, 90.3600, 0.7, 1000),
    Place("Kazipara-Shewrapara", "residential", 23.7930, 90.3740, 0.8, 1000),
    Place("Mohammadpur", "residential", 23.7610, 90.3590, 0.9, 1300),
    Place("Shyamoli-Adabor", "residential", 23.7720, 90.3580, 0.6, 1000),
    Place("Dhanmondi", "residential", 23.7460, 90.3740, 0.8, 1200),
    Place("Kalabagan-Green Road", "residential", 23.7480, 90.3840, 0.5, 800),
    Place("Uttara", "residential", 23.8690, 90.3960, 0.9, 1800),
    Place("Badda", "residential", 23.7810, 90.4280, 0.9, 1300),
    Place("Rampura-Banasree", "residential", 23.7610, 90.4250, 0.7, 1100),
    Place("Khilgaon", "residential", 23.7500, 90.4290, 0.6, 900),
    Place("Basabo", "residential", 23.7400, 90.4320, 0.5, 800),
    Place("Jatrabari", "residential", 23.7090, 90.4350, 0.8, 1200),
    Place("Old Dhaka", "residential", 23.7165, 90.4010, 0.9, 1200),
    Place("Lalbagh", "residential", 23.7190, 90.3870, 0.5, 800),
    Place("Wari", "residential", 23.7185, 90.4190, 0.5, 700),
    Place("Malibagh-Shantinagar", "residential", 23.7430, 90.4150, 0.6, 900),
    Place("Bashundhara R/A", "residential", 23.8185, 90.4330, 0.5, 1100),
    Place("Baridhara-Gulshan", "residential", 23.7980, 90.4180, 0.4, 1000),
    Place("Kafrul-Ibrahimpur", "residential", 23.7920, 90.3850, 0.6, 900),
    Place("Nikunja-Khilkhet", "residential", 23.8320, 90.4180, 0.5, 1000),
    Place("Moghbazar-Eskaton", "residential", 23.7480, 90.4010, 0.5, 800),
    # Offices and business districts
    Place("Motijheel CBD", "office", 23.7280, 90.4180, 1.0, 800),
    Place("Gulshan Avenue", "office", 23.7850, 90.4160, 1.0, 1000),
    Place("Banani", "office", 23.7940, 90.4040, 0.8, 800),
    Place("Karwan Bazar", "office", 23.7515, 90.3920, 0.9, 700),
    Place("Tejgaon Industrial Area", "office", 23.7640, 90.4010, 0.6, 900),
    Place("Paltan-Dilkusha", "office", 23.7335, 90.4125, 0.6, 600),
    Place("Secretariat", "office", 23.7290, 90.4080, 0.6, 500),
    Place("Agargaon", "office", 23.7780, 90.3780, 0.6, 800),
    Place("Mohakhali", "office", 23.7785, 90.4010, 0.5, 700),
    Place("Uttara Sector 1-3", "office", 23.8620, 90.4000, 0.4, 700),
    Place("Farmgate", "office", 23.7580, 90.3890, 0.4, 600),
    Place("Bashundhara", "office", 23.8150, 90.4290, 0.5, 800),
    # Retail and markets
    Place("New Market-Gausia", "retail", 23.7330, 90.3845, 1.0, 600),
    Place("Bashundhara City", "retail", 23.7510, 90.3900, 0.9, 500),
    Place("Jamuna Future Park", "retail", 23.8135, 90.4240, 1.0, 600),
    Place("Mouchak", "retail", 23.7460, 90.4120, 0.5, 500),
    Place("Gulshan 1 market", "retail", 23.7805, 90.4165, 0.5, 500),
    Place("Dhanmondi 27", "retail", 23.7555, 90.3740, 0.6, 600),
    Place("Mirpur 10 market", "retail", 23.8070, 90.3685, 0.6, 600),
    Place("Uttara Sector 7", "retail", 23.8680, 90.4005, 0.4, 600),
    Place("Chawkbazar", "retail", 23.7175, 90.3965, 0.5, 500),
    # Education
    Place("Dhaka University", "education", 23.7340, 90.3950, 1.0, 800),
    Place("BUET", "education", 23.7265, 90.3925, 0.6, 500),
    Place("North South University", "education", 23.8150, 90.4255, 0.7, 500),
    Place("BRAC University", "education", 23.7730, 90.4250, 0.5, 500),
    Place("AIUB", "education", 23.8220, 90.4270, 0.5, 500),
    Place("Dhaka College", "education", 23.7360, 90.3830, 0.4, 400),
    Place("East West University", "education", 23.7690, 90.4260, 0.3, 400),
    Place("Rajuk Uttara Model College", "education", 23.8690, 90.3920, 0.3, 400),
    # Hospitals
    Place("Dhaka Medical College Hospital", "hospital", 23.7255, 90.3975, 0.8, 400),
    Place("BSMMU", "hospital", 23.7390, 90.3950, 0.7, 400),
    Place("Square Hospital", "hospital", 23.7530, 90.3815, 0.5, 400),
    Place("Evercare Bashundhara", "hospital", 23.8100, 90.4320, 0.5, 400),
    Place("United Hospital", "hospital", 23.8045, 90.4150, 0.4, 400),
    Place("Sher-e-Bangla Nagar hospitals", "hospital", 23.7705, 90.3715, 0.5, 600),
    # Transport terminals (Eid exodus destinations)
    Place("Gabtoli Bus Terminal", "terminal", 23.7832, 90.3442, 1.0, 500),
    Place("Sayedabad Bus Terminal", "terminal", 23.7150, 90.4275, 1.0, 500),
    Place("Mohakhali Bus Terminal", "terminal", 23.7790, 90.3985, 0.7, 400),
    Place("Kamalapur Railway Station", "terminal", 23.7318, 90.4262, 0.9, 500),
    Place("Sadarghat Launch Terminal", "terminal", 23.7070, 90.4095, 0.8, 400),
    Place("Abdullahpur bus counters", "terminal", 23.8795, 90.4005, 0.5, 400),
    Place("Hazrat Shahjalal International Airport", "airport", 23.8513, 90.4086, 1.0, 600),
    # Mosques (Jumu'ah)
    Place("Baitul Mukarram National Mosque", "mosque", 23.7297, 90.4127, 1.0, 500),
    Place("Kakrail Mosque", "mosque", 23.7380, 90.4090, 0.6, 400),
    Place("Gulshan Azad Mosque", "mosque", 23.7825, 90.4150, 0.4, 400),
    Place("Mirpur Baitul Aman", "mosque", 23.8065, 90.3690, 0.4, 400),
    Place("Uttara Sector 7 mosque", "mosque", 23.8685, 90.4000, 0.3, 400),
    Place("Star Mosque", "mosque", 23.7160, 90.4010, 0.3, 400),
    Place("Mohammadpur Town Hall mosque", "mosque", 23.7600, 90.3620, 0.3, 400),
    Place("Dhanmondi Taqwa Mosque", "mosque", 23.7480, 90.3715, 0.3, 400),
    # Leisure
    Place("Hatirjheel", "leisure", 23.7560, 90.4080, 0.5, 700),
    Place("Dhanmondi Lake", "leisure", 23.7460, 90.3760, 0.4, 600),
    Place("Banani Road 11", "leisure", 23.7930, 90.4050, 0.6, 400),
    Place("Suhrawardy Udyan", "leisure", 23.7340, 90.4000, 0.3, 500),
    Place("Bashundhara ICCB", "leisure", 23.8185, 90.4220, 0.3, 400),
    # Stadiums
    Place("Sher-e-Bangla National Cricket Stadium", "stadium", 23.8069, 90.3632, 1.0, 350),
    Place("Bangabandhu National Stadium", "stadium", 23.7275, 90.4145, 0.4, 350),
]

MIRPUR_STADIUM = next(p for p in PLACES if p.name.startswith("Sher-e-Bangla National Cricket"))


def places_in(category: str) -> list[Place]:
    return [p for p in PLACES if p.category == category]
