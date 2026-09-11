import json
import unittest
from unittest.mock import patch

import extract


class TestNormalize(unittest.TestCase):
    def test_empty_fills_none(self):
        out = extract._normalize({})
        self.assertEqual(set(out.keys()), {*extract.VISIT_FIELDS, "items"})
        self.assertTrue(all(out[f] is None for f in extract.VISIT_FIELDS))
        self.assertEqual(out["items"], [])

    def test_carries_known_drops_unknown(self):
        raw = {"customer": "Hospital X", "junk_field": "ignore me",
               "items": [{"modality": "Desfibrilador", "junk": 1}]}
        out = extract._normalize(raw)
        self.assertEqual(out["customer"], "Hospital X")
        self.assertNotIn("junk_field", out)
        self.assertEqual(set(out["items"][0].keys()), set(extract.ITEM_FIELDS))

    def test_empty_string_becomes_none(self):
        out = extract._normalize({"city": "", "items": [{"modality": "Desfibrilador", "brand": "n/a"}]})
        self.assertIsNone(out["city"])
        self.assertIsNone(out["items"][0]["brand"])

    def test_all_null_items_dropped(self):
        out = extract._normalize({"items": [{"modality": None}, {"brand": ""}, "garbage"]})
        self.assertEqual(out["items"], [])


class TestSchema(unittest.TestCase):
    def test_schema_properties_match_fields(self):
        props = extract.JSON_SCHEMA["properties"]
        self.assertEqual(set(props.keys()), {*extract.VISIT_FIELDS, "items"})
        self.assertEqual(set(props["items"]["items"]["properties"].keys()), set(extract.ITEM_FIELDS))

    def test_modality_enum_is_taxonomy(self):
        enum = extract.JSON_SCHEMA["properties"]["items"]["items"]["properties"]["modality"]["enum"]
        self.assertIn("Desfibrilador", enum)
        self.assertIn("Monitor de Paciente", enum)
        self.assertIn(None, enum)


class TestExtract(unittest.TestCase):
    @patch("extract.qvac_client.extract_sync")
    def test_extract_keeps_every_item(self, mock_extract_sync):
        mock_extract_sync.return_value = json.dumps({
            "customer": "Hospital DemoCare Pacific", "country": "Panamá",
            "items": [
                {"modality": "Monitor de Paciente", "quantity": 2},
                {"modality": "Resonador Magnético (MRI)", "quantity": 1},
                {"modality": "Desfibrilador", "quantity": 1},
            ],
        })
        out = extract.extract("Vi 2 monitores, 1 resonador y 1 desfibrilador.")
        self.assertEqual(out["customer"], "Hospital DemoCare Pacific")
        self.assertEqual([i["modality"] for i in out["items"]],
                         ["Monitor de Paciente", "Resonador Magnético (MRI)", "Desfibrilador"])
        self.assertEqual([i["quantity"] for i in out["items"]], [2, 1, 1])
        self.assertIsNone(out["items"][0]["brand"])
        mock_extract_sync.assert_called_once()

    @patch("extract.qvac_client.extract_sync")
    def test_retries_all_null_cold_start(self, mock_extract_sync):
        mock_extract_sync.side_effect = [
            json.dumps({"customer": None, "items": []}),
            json.dumps({"items": [{"modality": "Desfibrilador", "quantity": 1}]}),
        ]
        out = extract.extract("Hay un desfibrilador.")
        self.assertEqual(out["items"][0]["modality"], "Desfibrilador")
        self.assertEqual(mock_extract_sync.call_count, 2)


if __name__ == "__main__":
    unittest.main()
