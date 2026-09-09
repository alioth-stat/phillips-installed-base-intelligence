import json
import unittest
from unittest.mock import patch

import extract


class TestNormalize(unittest.TestCase):
    def test_empty_fills_none(self):
        out = extract._normalize({})
        self.assertEqual(set(out.keys()), set(extract.EXTRACTION_FIELDS))
        self.assertTrue(all(v is None for v in out.values()))

    def test_carries_known_drops_unknown(self):
        raw = {"customer": "Hospital X", "junk_field": "ignore me"}
        out = extract._normalize(raw)
        self.assertEqual(out["customer"], "Hospital X")
        self.assertNotIn("junk_field", out)
        self.assertEqual(set(out.keys()), set(extract.EXTRACTION_FIELDS))

    def test_empty_string_becomes_none(self):
        out = extract._normalize({"city": ""})
        self.assertIsNone(out["city"])


class TestSchema(unittest.TestCase):
    def test_schema_properties_match_fields(self):
        self.assertEqual(set(extract.JSON_SCHEMA["properties"].keys()), set(extract.EXTRACTION_FIELDS))


class TestExtract(unittest.TestCase):
    @patch("extract.qvac_client.extract_sync")
    def test_extract_wires_and_normalizes(self, mock_extract_sync):
        mock_extract_sync.return_value = json.dumps(
            {"customer": "Hospital DemoCare Pacific", "country": "Panamá", "quantity": 2}
        )
        out = extract.extract("Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores.")
        self.assertEqual(set(out.keys()), set(extract.EXTRACTION_FIELDS))
        self.assertEqual(out["customer"], "Hospital DemoCare Pacific")
        self.assertEqual(out["country"], "Panamá")
        self.assertEqual(out["quantity"], 2)
        self.assertIsNone(out["brand"])
        mock_extract_sync.assert_called_once()


if __name__ == "__main__":
    unittest.main()
