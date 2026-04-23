"""Sync service tests."""

from unittest.mock import patch

from django.test import TestCase

from sync.services.push_services import _conflict_row
from sync.services.resource_dicts import RESOURCE_DICT_MAP


class ConflictRowResourceTagTests(TestCase):
    """The frontend (`src/lib/sync/push.ts` `applyServerRow`) dispatches
    server-authoritative push rows to the correct local table by reading
    the `_resource` tag on the row. Without this tag, the push result
    cannot emit a change event and UIs stay stale after conflicts."""

    def test_every_registered_resource_gets_tag(self):
        for resource_name, (model_cls, _to_dict) in RESOURCE_DICT_MAP.items():
            # Swap in a stub serializer so this test doesn't need DB fixtures.
            stub_map = {**RESOURCE_DICT_MAP}
            stub_map[resource_name] = (model_cls, lambda _instance: {"id": "x"})
            with patch.dict(
                "sync.services.push_services.RESOURCE_DICT_MAP",
                stub_map,
                clear=True,
            ):
                row = _conflict_row(resource_name, object())
            self.assertEqual(
                row.get("_resource"),
                resource_name,
                msg=f"_resource tag missing or wrong on '{resource_name}'",
            )
