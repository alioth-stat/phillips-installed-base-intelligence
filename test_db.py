import os
import tempfile
import unittest

import db


class TestDb(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        os.remove(self.path)  # must not exist yet, so init_db treats it as new
        self.conn = db.init_db(self.path)

    def tearDown(self):
        self.conn.close()
        os.remove(self.path)

    def test_taxonomy_seeded(self):
        self.assertTrue(len(db.get_taxonomy(self.conn, "modality")) > 0)
        self.assertTrue(len(db.get_taxonomy(self.conn, "brand")) > 0)

    def test_insert_and_fetch(self):
        obs_id = db.insert_observation(self.conn, {
            "customer": "Hospital DemoCare Pacific",
            "city": "Panama",
            "country": "Panama",
            "modality": "Resonador Magnético (MRI)",
            "brand": None,
            "model": None,
            "quantity": 2,
            "age_years": 8,
            "status": "reported",
            "confidence": 0.5,
            "source_text": "dos resonadores",
        })
        self.assertIsInstance(obs_id, int)

        all_rows = db.get_all_observations(self.conn)
        self.assertEqual(len(all_rows), 1)
        self.assertEqual(all_rows[0]["id"], obs_id)
        self.assertEqual(all_rows[0]["corroboration_count"], 1)

        by_customer = db.get_observations_by_customer(self.conn, "hospital democare pacific")
        self.assertEqual(len(by_customer), 1)

    def test_update_corroboration(self):
        obs_id = db.insert_observation(self.conn, {"customer": "X", "status": "reported", "confidence": 0.4})
        db.update_corroboration(self.conn, obs_id, new_confidence=0.9, new_status="confirmed")
        row = db.get_all_observations(self.conn)[0]
        self.assertEqual(row["corroboration_count"], 2)
        self.assertEqual(row["confidence"], 0.9)
        self.assertEqual(row["status"], "confirmed")


if __name__ == "__main__":
    unittest.main()
