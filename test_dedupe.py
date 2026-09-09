import unittest

from dedupe import find_duplicate


class TestFindDuplicate(unittest.TestCase):
    def test_matches_minor_spelling_variation(self):
        existing = [{
            "customer": "Hospital Democare Pacific",
            "city": "Panama",
            "modality": "Resonador Magnetico",
            "brand": "Philips",
        }]
        candidate = {
            "customer": "Hospital DemoCare Pacific",
            "city": "Panama",
            "modality": "Resonador Magnetico",
            "brand": "Philips",
        }
        result = find_duplicate(candidate, existing)
        self.assertEqual(result, existing[0])

    def test_no_similar_rows_returns_none(self):
        existing = [{
            "customer": "Clinica San Fernando",
            "city": "David",
            "modality": "Ecografo",
            "brand": "Mindray",
        }]
        candidate = {
            "customer": "Hospital Nacional",
            "city": "Santiago",
            "modality": "Ventilador",
            "brand": "Drager",
        }
        self.assertIsNone(find_duplicate(candidate, existing))

    def test_empty_existing_rows_returns_none(self):
        candidate = {"customer": "X", "city": "Y", "modality": "Z", "brand": "W"}
        self.assertIsNone(find_duplicate(candidate, []))

    def test_returns_highest_scoring_match(self):
        candidate = {
            "customer": "Hospital DemoCare Pacific",
            "city": "Panama",
            "modality": "Resonador Magnetico",
            "brand": "Philips",
        }
        close = {
            "customer": "Hospital DemoCare Pacific",
            "city": "Panama",
            "modality": "Resonador Magnetico",
            "brand": "Philips",
        }
        far = {
            "customer": "Hospital DemoCare Pacif",
            "city": "Panam",
            "modality": "Resonador Magn",
            "brand": "Phil",
        }
        result = find_duplicate(candidate, [far, close])
        self.assertEqual(result, close)


if __name__ == "__main__":
    unittest.main()
