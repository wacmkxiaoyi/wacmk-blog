import io
import json
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.blog.forms.site import SiteSettingForm
from apps.blog.utils import get_site_setting, set_settings
from apps.blog.utils.site import (
    LIVE2D_PAGE_GROUP_ARTICLE_DETAIL,
    LIVE2D_PAGE_GROUP_HOME,
    LIVE2D_SOURCE_CUBISM_BUNDLE,
    LIVE2D_SOURCE_WIDGET_BUNDLE,
    build_live2d_runtime_config,
    get_live2d_page_group,
    inspect_live2d_cubism_bundle,
    inspect_live2d_widget_bundle,
)


User = get_user_model()


def build_live2d_widget_bundle_file(name="live2d-widget-bundle.zip"):
    buffer = io.BytesIO()
    manifest = {
        "version": 1,
        "engine": "live2d-widget",
        "entry": {
            "js": "waifu/waifu-tips.js",
            "css": "waifu/waifu.css",
            "waifuPath": "waifu/waifu-tips.json",
            "assetsBase": "models/",
        },
        "models": [{"id": 0, "name": "Shizuku"}],
        "defaults": {"modelId": 0, "position": "right", "scale": 1},
    }
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=True))
        archive.writestr("waifu/waifu-tips.js", "window.initWidget = window.initWidget || function () {};\n")
        archive.writestr("waifu/waifu.css", "#waifu { position: fixed; }\n")
        archive.writestr("waifu/waifu-tips.json", "{}")
        archive.writestr("models/model_list.json", "[]")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="application/zip")


def build_live2d_cubism_bundle_file(name="live2d-cubism-bundle.zip"):
    buffer = io.BytesIO()
    manifest = {
        "version": 1,
        "engine": "cubism-runtime",
        "models": [
            {
                "id": 0,
                "name": "Hiyori",
                "groupId": "hiyori",
                "textureVariantId": "default",
                "textureVariantName": "Default",
                "modelJson": "runtime/hiyori.model3.json",
            },
            {
                "id": 1,
                "name": "Hiyori",
                "groupId": "hiyori",
                "textureVariantId": "summer",
                "textureVariantName": "Summer",
                "modelJson": "runtime/hiyori-summer.model3.json",
            },
        ],
        "defaults": {"modelId": 0, "scale": 1},
    }
    model_definition = {
        "Version": 3,
        "FileReferences": {
            "Moc": "hiyori.moc3",
            "Textures": ["textures/texture_00.png"],
            "Physics": "hiyori.physics3.json",
            "DisplayInfo": "hiyori.cdi3.json",
            "Expressions": [
                {"Name": "smile", "File": "expressions/smile.exp3.json"}
            ],
            "Motions": {
                "Idle": [
                    {"File": "motions/idle.motion3.json"}
                ],
                "TapBody": [
                    {"File": "motions/tap.motion3.json", "Sound": "sounds/tap.mp3"}
                ]
            },
        },
    }
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=True))
        archive.writestr("runtime/hiyori.model3.json", json.dumps(model_definition, ensure_ascii=True))
        archive.writestr("runtime/hiyori-summer.model3.json", json.dumps(model_definition, ensure_ascii=True))
        archive.writestr("runtime/hiyori.moc3", b"moc3")
        archive.writestr("runtime/hiyori.physics3.json", "{}")
        archive.writestr("runtime/hiyori.cdi3.json", "{}")
        archive.writestr("runtime/expressions/smile.exp3.json", "{}")
        archive.writestr("runtime/motions/idle.motion3.json", "{}")
        archive.writestr("runtime/motions/tap.motion3.json", "{}")
        archive.writestr("runtime/sounds/tap.mp3", b"mp3")
        archive.writestr("runtime/textures/texture_00.png", b"png")
        archive.writestr("editor/project.cmo3", b"cmo3")
        archive.writestr("editor/animation.can3", b"can3")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="application/zip")


def build_live2d_cubism_bundle_file_without_manifest(name="live2d-cubism-bundle-no-manifest.zip"):
    buffer = io.BytesIO()
    model_definition = {
        "Version": 3,
        "FileReferences": {
            "Moc": "hiyori.moc3",
            "Textures": ["textures/texture_00.png"],
            "Physics": "hiyori.physics3.json",
            "DisplayInfo": "hiyori.cdi3.json",
            "Expressions": [
                {"Name": "smile", "File": "expressions/smile.exp3.json"}
            ],
            "Motions": {
                "Idle": [
                    {"File": "motions/idle.motion3.json"}
                ],
                "TapBody": [
                    {"File": "motions/tap.motion3.json"}
                ]
            },
        },
    }
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("models/hiyori/hiyori.model3.json", json.dumps(model_definition, ensure_ascii=True))
        archive.writestr("models/hiyori/hiyori.moc3", b"moc3")
        archive.writestr("models/hiyori/hiyori.physics3.json", "{}")
        archive.writestr("models/hiyori/hiyori.cdi3.json", "{}")
        archive.writestr("models/hiyori/expressions/smile.exp3.json", "{}")
        archive.writestr("models/hiyori/motions/idle.motion3.json", "{}")
        archive.writestr("models/hiyori/motions/tap.motion3.json", "{}")
        archive.writestr("models/hiyori/textures/texture_00.png", b"png")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="application/zip")


def build_live2d_cubism_bundle_file_missing_expression(name="live2d-cubism-bundle-missing-expression.zip"):
    bundle = build_live2d_cubism_bundle_file(name=name)
    buffer = io.BytesIO(bundle.read())
    rebuilt = io.BytesIO()
    with zipfile.ZipFile(buffer, "r") as source_archive:
        with zipfile.ZipFile(rebuilt, "w") as archive:
            for member in source_archive.infolist():
                if member.filename == "runtime/expressions/smile.exp3.json":
                    continue
                archive.writestr(member, source_archive.read(member.filename))
    rebuilt.seek(0)
    return SimpleUploadedFile(name, rebuilt.read(), content_type="application/zip")


def build_live2d_cubism_bundle_file_missing_motion(name="live2d-cubism-bundle-missing-motion.zip"):
    bundle = build_live2d_cubism_bundle_file(name=name)
    buffer = io.BytesIO(bundle.read())
    rebuilt = io.BytesIO()
    with zipfile.ZipFile(buffer, "r") as source_archive:
        with zipfile.ZipFile(rebuilt, "w") as archive:
            for member in source_archive.infolist():
                if member.filename == "runtime/motions/tap.motion3.json":
                    continue
                archive.writestr(member, source_archive.read(member.filename))
    rebuilt.seek(0)
    return SimpleUploadedFile(name, rebuilt.read(), content_type="application/zip")


class Live2DSiteSettingFormTests(TestCase):
    def build_form_data(self, **overrides):
        data = {
            "site_title": "",
            "enable_register": "",
            "code_expire_seconds": 600,
            "code_resend_seconds": 60,
            "live2d_enabled": "on",
            "live2d_source_type": "cdn",
            "live2d_model_id": 0,
            "live2d_random_model": "on",
            "live2d_show_on_home": "on",
            "live2d_show_on_article_list": "on",
            "live2d_show_on_article_detail": "on",
            "live2d_show_on_book_list": "on",
            "live2d_show_on_book_detail": "on",
            "live2d_show_on_public_share_pages": "on",
            "live2d_cdn_autoload_url": "https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/autoload.js",
            "live2d_cdn_waifu_path": "",
            "live2d_cdn_assets_base": "https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/",
            "live2d_tips_enabled": "on",
            "live2d_tips_mode": "hybrid",
            "live2d_tips_welcome_text": "hello\nwelcome",
            "live2d_tips_idle_text": "idle one",
            "live2d_tips_touch_text": "touch one",
            "live2d_tips_home_text": "home one",
            "live2d_tips_article_text": "article one",
            "live2d_tips_book_text": "book one",
            "live2d_tips_profile_text": "profile one",
            "live2d_tips_rules_json": json.dumps([
                {"selector": ".nav-search-input", "texts": ["search tip"], "pageGroups": ["home"]}
            ]),
            "post_editor_autosave_enabled": "on",
            "post_editor_autosave_interval_minutes": 5,
            "audit_log_cleanup_enabled": "on",
            "audit_log_retention_days": 30,
            "vip_max_level": 0,
            "dashboard_visit_trend_days": 7,
            "non_admin_max_post_count": 10,
            "non_admin_max_book_count": 3,
            "attachment_max_size_mb": 1,
            "allow_user_comment": "on",
            "comment_first_reward_money": "1",
            "comment_first_reward_points": "1",
            "daily_login_reward_money": "10",
            "daily_login_reward_points": "10",
            "article_author_reward_money_ratio": "0.8",
            "article_author_reward_points_ratio": "0",
            "book_author_reward_money_ratio": "0.8",
            "book_author_reward_points_ratio": "0",
            "attachment_author_reward_money_ratio": "0.8",
            "attachment_author_reward_points_ratio": "0",
        }
        data.update(overrides)
        return data

    def test_live2d_tip_textareas_are_parsed_into_config(self):
        form = SiteSettingForm(data=self.build_form_data())

        self.assertTrue(form.is_valid(), form.errors)
        saved = form.save()

        self.assertEqual(saved["live2d_tips_config"]["welcome"], ["hello", "welcome"])
        self.assertEqual(saved["live2d_tips_config"]["pages"][LIVE2D_PAGE_GROUP_HOME], ["home one"])
        self.assertEqual(saved["live2d_tips_config"]["rules"][0]["selector"], ".nav-search-input")

    def test_live2d_rules_json_requires_valid_structure(self):
        form = SiteSettingForm(data=self.build_form_data(live2d_tips_rules_json='[{"selector":"","texts":[]}]'))

        self.assertFalse(form.is_valid())
        self.assertIn("selector", str(form.errors["live2d_tips_rules_json"][0]).lower())

    def test_upload_mode_requires_bundle_when_enabled(self):
        form = SiteSettingForm(data=self.build_form_data(live2d_source_type=LIVE2D_SOURCE_WIDGET_BUNDLE))

        self.assertFalse(form.is_valid())
        self.assertIn("bundle", str(form.errors["live2d_widget_bundle_file"][0]).lower())

    def test_cubism_mode_requires_bundle_when_enabled(self):
        form = SiteSettingForm(data=self.build_form_data(live2d_source_type=LIVE2D_SOURCE_CUBISM_BUNDLE))

        self.assertFalse(form.is_valid())
        self.assertIn("bundle", str(form.errors["live2d_cubism_bundle_file"][0]).lower())

    def test_bundle_manifest_is_inspected(self):
        bundle = build_live2d_widget_bundle_file()
        manifest = inspect_live2d_widget_bundle(bundle)

        self.assertEqual(manifest["engine"], "live2d-widget")
        self.assertEqual(manifest["models"][0]["id"], 0)

    def test_cubism_bundle_manifest_is_inspected(self):
        bundle = build_live2d_cubism_bundle_file()
        manifest = inspect_live2d_cubism_bundle(bundle)

        self.assertEqual(manifest["engine"], "cubism-runtime")
        self.assertEqual(manifest["models"][0]["modelJson"], "runtime/hiyori.model3.json")
        self.assertEqual(manifest["models"][1]["groupId"], "hiyori")
        self.assertEqual(manifest["models"][1]["textureVariantId"], "summer")
        self.assertEqual(manifest["models"][0]["expressions"][0]["name"], "smile")
        self.assertEqual(manifest["models"][0]["motionGroups"], ["Idle", "TapBody"])
        self.assertEqual(manifest["models"][0]["hitMotionGroups"], ["TapBody"])
        self.assertTrue(manifest["models"][0]["hasPhysics"])
        self.assertTrue(manifest["models"][0]["hasDisplayInfo"])
        self.assertTrue(manifest["models"][0]["hasSound"])

    def test_cubism_bundle_without_manifest_is_discovered(self):
        bundle = build_live2d_cubism_bundle_file_without_manifest()
        manifest = inspect_live2d_cubism_bundle(bundle)

        self.assertEqual(manifest["engine"], "cubism-runtime")
        self.assertEqual(manifest["models"][0]["modelJson"], "models/hiyori/hiyori.model3.json")
        self.assertEqual(manifest["defaults"]["modelId"], 0)
        self.assertEqual(manifest["models"][0]["expressions"][0]["name"], "smile")

    def test_cubism_bundle_rejects_missing_expression_dependency(self):
        bundle = build_live2d_cubism_bundle_file_missing_expression()

        with self.assertRaisesMessage(ValueError, "missing a file referenced by model3.json"):
            inspect_live2d_cubism_bundle(bundle)

    def test_cubism_bundle_rejects_missing_motion_dependency(self):
        bundle = build_live2d_cubism_bundle_file_missing_motion()

        with self.assertRaisesMessage(ValueError, "missing a file referenced by model3.json"):
            inspect_live2d_cubism_bundle(bundle)

    def test_random_model_defaults_to_enabled(self):
        form = SiteSettingForm()

        self.assertTrue(form.initial["live2d_random_model"])

    def test_upload_mode_allows_out_of_range_model_id_when_random_enabled(self):
        form = SiteSettingForm(
            data=self.build_form_data(live2d_source_type=LIVE2D_SOURCE_WIDGET_BUNDLE, live2d_model_id=99),
            files={"live2d_widget_bundle_file": build_live2d_widget_bundle_file()},
        )

        self.assertTrue(form.is_valid(), form.errors)

    def test_upload_mode_requires_valid_model_id_when_random_disabled(self):
        form = SiteSettingForm(
            data=self.build_form_data(
                live2d_source_type=LIVE2D_SOURCE_WIDGET_BUNDLE,
                live2d_random_model="",
                live2d_model_id=99,
            ),
            files={"live2d_widget_bundle_file": build_live2d_widget_bundle_file()},
        )

        self.assertFalse(form.is_valid())
        self.assertIn("model ids", str(form.errors["live2d_model_id"][0]).lower())

    def test_cubism_mode_requires_valid_model_id_when_random_disabled(self):
        form = SiteSettingForm(
            data=self.build_form_data(
                live2d_source_type=LIVE2D_SOURCE_CUBISM_BUNDLE,
                live2d_random_model="",
                live2d_model_id=99,
            ),
            files={"live2d_cubism_bundle_file": build_live2d_cubism_bundle_file()},
        )

        self.assertFalse(form.is_valid())
        self.assertIn("model ids", str(form.errors["live2d_model_id"][0]).lower())


class Live2DRuntimeConfigTests(TestCase):
    def test_page_group_mapping_covers_expected_routes(self):
        self.assertEqual(get_live2d_page_group("blog-home"), "home")
        self.assertEqual(get_live2d_page_group("blog-detail"), "article_detail")
        self.assertEqual(get_live2d_page_group("manage-posts"), "manage_pages")

    def test_runtime_config_respects_page_group_switches(self):
        set_settings(
            {
                "live2d_enabled": True,
                "live2d_source_type": "cdn",
                "live2d_show_on_home": True,
                "live2d_show_on_article_detail": False,
            }
        )
        site_setting = get_site_setting()

        request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-home"})()})()
        detail_request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-detail"})()})()

        self.assertIsNotNone(build_live2d_runtime_config(site_setting, request))
        self.assertIsNone(build_live2d_runtime_config(site_setting, detail_request))

    def test_runtime_config_uses_fixed_left_responsive_behavior(self):
        set_settings(
            {
                "live2d_enabled": True,
                "live2d_source_type": "cdn",
                "live2d_show_on_home": True,
            }
        )
        site_setting = get_site_setting()
        request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-home"})()})()

        runtime_config = build_live2d_runtime_config(site_setting, request)

        self.assertIsNotNone(runtime_config)
        self.assertNotIn("position", runtime_config)
        self.assertNotIn("scale", runtime_config)
        self.assertNotIn("rememberClose", runtime_config)

    def test_runtime_config_keeps_fallback_model_id_when_random_enabled(self):
        set_settings(
            {
                "live2d_enabled": True,
                "live2d_source_type": "cdn",
                "live2d_random_model": True,
                "live2d_model_id": 3,
                "live2d_show_on_home": True,
            }
        )
        site_setting = get_site_setting()
        request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-home"})()})()

        runtime_config = build_live2d_runtime_config(site_setting, request)

        self.assertTrue(runtime_config["randomModel"])
        self.assertEqual(runtime_config["modelId"], 3)

    def test_runtime_config_keeps_fixed_model_id_when_random_disabled(self):
        set_settings(
            {
                "live2d_enabled": True,
                "live2d_source_type": "cdn",
                "live2d_random_model": False,
                "live2d_model_id": 3,
                "live2d_show_on_home": True,
            }
        )
        site_setting = get_site_setting()
        request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-home"})()})()

        runtime_config = build_live2d_runtime_config(site_setting, request)

        self.assertFalse(runtime_config["randomModel"])
        self.assertEqual(runtime_config["modelId"], 3)

    def test_runtime_config_supports_cubism_bundle(self):
        set_settings(
            {
                "live2d_enabled": True,
                "live2d_source_type": LIVE2D_SOURCE_CUBISM_BUNDLE,
                "live2d_model_id": 0,
                "live2d_random_model": False,
                "live2d_show_on_home": True,
                "live2d_cubism_bundle_manifest": {
                    "version": 1,
                    "engine": "cubism-runtime",
                    "models": [
                        {
                            "id": 0,
                            "name": "Hiyori",
                            "modelJson": "runtime/hiyori.model3.json",
                            "groupId": "hiyori",
                            "textureVariantId": "default",
                            "textureVariantName": "Default",
                            "expressions": [{"name": "smile", "file": "expressions/smile.exp3.json"}],
                            "motionGroups": ["Idle", "TapBody"],
                            "hitMotionGroups": ["TapBody"],
                            "hasPhysics": True,
                            "hasDisplayInfo": True,
                            "hasSound": True,
                        },
                        {
                            "id": 1,
                            "name": "Hiyori",
                            "modelJson": "runtime/hiyori-summer.model3.json",
                            "groupId": "hiyori",
                            "textureVariantId": "summer",
                            "textureVariantName": "Summer",
                            "expressions": [],
                            "motionGroups": ["Idle"],
                            "hitMotionGroups": [],
                            "hasPhysics": True,
                            "hasDisplayInfo": True,
                            "hasSound": False,
                        },
                    ],
                    "defaults": {"modelId": 0, "scale": "1"},
                },
                "live2d_cubism_bundle_extract_root": "site/live2d/cubism/extracted/demo",
            }
        )
        site_setting = get_site_setting()
        request = type("Request", (), {"resolver_match": type("Resolver", (), {"url_name": "blog-home"})()})()

        runtime_config = build_live2d_runtime_config(site_setting, request)

        self.assertEqual(runtime_config["sourceType"], LIVE2D_SOURCE_CUBISM_BUNDLE)
        self.assertEqual(runtime_config["engine"], "cubism-runtime")
        self.assertEqual(runtime_config["entry"]["models"][0]["modelJsonUrl"], "/media/site/live2d/cubism/extracted/demo/runtime/hiyori.model3.json")
        self.assertEqual(runtime_config["entry"]["models"][0]["groupId"], "hiyori")
        self.assertEqual(runtime_config["entry"]["models"][1]["textureVariantId"], "summer")
        self.assertEqual(runtime_config["entry"]["models"][0]["motionGroups"], ["Idle", "TapBody"])
        self.assertEqual(runtime_config["entry"]["models"][0]["hitMotionGroups"], ["TapBody"])
        self.assertEqual(runtime_config["entry"]["models"][0]["expressions"][0]["name"], "smile")
        self.assertTrue(runtime_config["entry"]["models"][0]["hasSound"])
        self.assertIn("messages", runtime_config)
        self.assertIn("cubismUnsupported", runtime_config["messages"])
        self.assertIn("expressionSwitched", runtime_config["messages"])
        self.assertIn("motionPlayed", runtime_config["messages"])


class ManageSiteSettingLive2DTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="admin-pass-123")
        self.client.force_login(self.admin)
        self.url = reverse("manage-site-settings")

    def test_manage_page_renders_live2d_section(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("<h2>Live2D</h2>", content)
        self.assertIn("live2d_tips_rules_json", content)

    def test_manage_page_accepts_live2d_bundle_upload(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root), MEDIA_URL="/media/"):
                response = self.client.post(
                    self.url,
                    {
                        "site_title": "",
                        "code_expire_seconds": 600,
                        "code_resend_seconds": 60,
                        "live2d_enabled": "on",
                        "live2d_source_type": LIVE2D_SOURCE_WIDGET_BUNDLE,
                        "live2d_model_id": 0,
                        "live2d_random_model": "on",
                        "live2d_show_on_home": "on",
                        "live2d_tips_enabled": "on",
                        "live2d_tips_mode": "custom",
                        "live2d_tips_rules_json": "[]",
                        "post_editor_autosave_enabled": "on",
                        "post_editor_autosave_interval_minutes": 5,
                        "audit_log_cleanup_enabled": "on",
                        "audit_log_retention_days": 30,
                        "vip_max_level": 0,
                        "dashboard_visit_trend_days": 7,
                        "non_admin_max_post_count": 10,
                        "non_admin_max_book_count": 3,
                        "attachment_max_size_mb": 1,
                        "allow_user_comment": "on",
                        "comment_first_reward_money": "1",
                        "comment_first_reward_points": "1",
                        "daily_login_reward_money": "10",
                        "daily_login_reward_points": "10",
                        "article_author_reward_money_ratio": "0.8",
                        "article_author_reward_points_ratio": "0",
                        "book_author_reward_money_ratio": "0.8",
                        "book_author_reward_points_ratio": "0",
                        "attachment_author_reward_money_ratio": "0.8",
                        "attachment_author_reward_points_ratio": "0",
                        "live2d_widget_bundle_file": build_live2d_widget_bundle_file(),
                    },
                )

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.url, self.url)

    def test_manage_page_accepts_live2d_cubism_bundle_upload(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root), MEDIA_URL="/media/"):
                response = self.client.post(
                    self.url,
                    {
                        "site_title": "",
                        "code_expire_seconds": 600,
                        "code_resend_seconds": 60,
                        "live2d_enabled": "on",
                        "live2d_source_type": LIVE2D_SOURCE_CUBISM_BUNDLE,
                        "live2d_model_id": 0,
                        "live2d_random_model": "on",
                        "live2d_show_on_home": "on",
                        "live2d_tips_enabled": "on",
                        "live2d_tips_mode": "custom",
                        "live2d_tips_rules_json": "[]",
                        "post_editor_autosave_enabled": "on",
                        "post_editor_autosave_interval_minutes": 5,
                        "audit_log_cleanup_enabled": "on",
                        "audit_log_retention_days": 30,
                        "vip_max_level": 0,
                        "dashboard_visit_trend_days": 7,
                        "non_admin_max_post_count": 10,
                        "non_admin_max_book_count": 3,
                        "attachment_max_size_mb": 1,
                        "allow_user_comment": "on",
                        "comment_first_reward_money": "1",
                        "comment_first_reward_points": "1",
                        "daily_login_reward_money": "10",
                        "daily_login_reward_points": "10",
                        "article_author_reward_money_ratio": "0.8",
                        "article_author_reward_points_ratio": "0",
                        "book_author_reward_money_ratio": "0.8",
                        "book_author_reward_points_ratio": "0",
                        "attachment_author_reward_money_ratio": "0.8",
                        "attachment_author_reward_points_ratio": "0",
                        "live2d_cubism_bundle_file": build_live2d_cubism_bundle_file(),
                    },
                )

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.url, self.url)
