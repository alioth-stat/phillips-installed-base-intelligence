import unittest

from confidence import compute_confidence


class TestComputeConfidence(unittest.TestCase):
    def test_all_fields_and_corroboration_confirmed(self):
        fields = {
            "customer": "Hospital X", "city": "Panama", "country": "Panama",
            "modality": "MRI", "brand": "Philips", "model": "Ingenia",
        }
        score, status = compute_confidence(fields, corroboration_count=2)
        self.assertEqual(status, "confirmed")
        self.assertIsInstance(score, float)
        self.assertTrue(0 <= score <= 1)

    def test_partial_fields_low_corroboration_reported(self):
        fields = {
            "customer": "Hospital X", "city": "Panama", "country": "Panama",
            "modality": "MRI",
        }
        score, status = compute_confidence(fields, corroboration_count=1)
        self.assertEqual(status, "reported")
        self.assertTrue(0 <= score <= 1)

    def test_one_field_estimated(self):
        fields = {"customer": "Hospital X"}
        score, status = compute_confidence(fields, corroboration_count=1)
        self.assertEqual(status, "estimated")
        self.assertTrue(0 <= score <= 1)

    def test_no_fields_unknown(self):
        score, status = compute_confidence({}, corroboration_count=1)
        self.assertEqual(status, "unknown")
        self.assertTrue(0 <= score <= 1)


if __name__ == "__main__":
    unittest.main()
