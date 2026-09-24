#!/usr/bin/env python3
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MATERIALS_JSON = ROOT / "data" / "materials.json"
QUESTION_JSON = ROOT / "data" / "question-catalog.json"
QUESTION_JS = ROOT / "data" / "question-catalog.js"
REVIEW_JSON = ROOT / "data" / "review-catalog.json"
REVIEW_JS = ROOT / "data" / "review-catalog.js"


class TopicParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.branch = ""
        self.branch_depth = None
        self.topic = None
        self.topic_depth = None
        self.capture = None
        self.capture_tag = None
        self.buf = []
        self.topics = []

    @staticmethod
    def _classes(attrs):
        return set((attrs.get("class") or "").split())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = self._classes(attrs)
        depth = len(self.stack)
        self.stack.append(tag)

        if tag == "section" and "ramo" in classes:
            self.branch = ""
            self.branch_depth = depth

        if "ramo-title" in classes and self.branch_depth is not None:
            self.capture = "branch"
            self.capture_tag = tag
            self.buf = []

        if tag == "details" and "topic-card" in classes:
            self.topic = {
                "topicId": attrs.get("data-topic-id", ""),
                "markers": [
                    x.strip()
                    for x in (attrs.get("data-markers") or "").split(",")
                    if x.strip()
                ],
                "branch": self.branch,
                "ref": "",
                "title": "",
                "qdata": {},
            }
            self.topic_depth = depth

        if self.topic is not None and "topic-code" in classes:
            self.capture = "ref"
            self.capture_tag = tag
            self.buf = []

        if self.topic is not None and "topic-name" in classes:
            self.capture = "title"
            self.capture_tag = tag
            self.buf = []

        if (
            self.topic is not None
            and tag == "script"
            and attrs.get("type") == "application/json"
            and "v134-question-data" in classes
        ):
            self.capture = "qdata"
            self.capture_tag = tag
            self.buf = []

    def handle_data(self, data):
        if self.capture:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if self.capture and tag == self.capture_tag:
            raw = "".join(self.buf)
            if self.capture == "branch":
                self.branch = " ".join(raw.split())
            elif self.topic is not None and self.capture in {"ref", "title"}:
                self.topic[self.capture] = " ".join(raw.split())
            elif self.topic is not None and self.capture == "qdata":
                try:
                    self.topic["qdata"] = json.loads(raw)
                except Exception:
                    self.topic["qdata"] = {}
            self.capture = None
            self.capture_tag = None
            self.buf = []

        if tag in self.stack:
            idx = len(self.stack) - 1 - self.stack[::-1].index(tag)
            self.stack = self.stack[:idx]

        if (
            tag == "details"
            and self.topic is not None
            and self.topic_depth is not None
            and len(self.stack) <= self.topic_depth
        ):
            self.topics.append(self.topic)
            self.topic = None
            self.topic_depth = None

        if (
            tag == "section"
            and self.branch_depth is not None
            and len(self.stack) <= self.branch_depth
        ):
            self.branch = ""
            self.branch_depth = None


def parse_topics(path):
    parser = TopicParser()
    parser.feed(path.read_text("utf-8", errors="ignore"))
    return parser.topics


def build():
    materials = json.loads(MATERIALS_JSON.read_text("utf-8"))["materials"]
    question_topics = []
    review_topics = []

    for material in materials:
        path = ROOT / material["src"]

        for topic in parse_topics(path):
            qdata = topic["qdata"]
            variants = []

            for variant in qdata.get("variants", []) or []:
                variants.append(
                    {
                        "id": variant.get("id", ""),
                        "difficulty": variant.get("difficulty", ""),
                        "type": variant.get("type", ""),
                        "trapType": variant.get("trapType", ""),
                        "skill": variant.get("skill", ""),
                        "interdisciplinary": bool(
                            variant.get("interdisciplinary", False)
                        ),
                        "antidoteFor": variant.get("antidoteFor", []) or [],
                    }
                )

            base = {
                "contestId": material.get("contestId")
                or "demhab-poa-arquiteto-2026",
                "materialId": material["id"],
                "storageNamespace": material.get("storageNamespace")
                or material["id"],
                "src": material["src"],
                "shortCode": material.get("shortCode", ""),
                "materialTitle": material.get("title", ""),
                "group": material.get("group", ""),
                "topicId": topic["topicId"],
                "title": topic["title"],
            }

            question_topics.append(
                {
                    **base,
                    "branch": topic["branch"],
                    "ref": topic["ref"],
                    "bank": qdata.get("bank", ""),
                    "source": qdata.get("source", ""),
                    "incidenceClass": qdata.get("incidenceClass", ""),
                    "variantCount": len(variants),
                    "variants": variants,
                }
            )

            review_topics.append(
                {
                    **base,
                    "ref": topic["ref"],
                    "branch": topic["branch"],
                    "markers": topic["markers"],
                    "hasQuestion": bool(variants),
                }
            )

    levels = Counter()
    types = Counter()
    variant_count = 0

    for topic in question_topics:
        for variant in topic["variants"]:
            variant_count += 1
            levels[variant["difficulty"]] += 1
            types[variant["type"]] += 1

    question_payload = {
        "schema": 1,
        "topics": question_topics,
        "summary": {
            "topics": len(question_topics),
            "variants": variant_count,
            "levels": dict(levels),
            "types": dict(types),
        },
    }
    review_payload = {"schema": 1, "topics": review_topics}

    QUESTION_JSON.write_text(
        json.dumps(question_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    QUESTION_JS.write_text(
        "window.PLANO_ARQ_QUESTION_CATALOG="
        + json.dumps(question_payload, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )
    REVIEW_JSON.write_text(
        json.dumps(review_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REVIEW_JS.write_text(
        "window.PLANO_ARQ_REVIEW_CATALOG="
        + json.dumps(review_payload, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )

    print(
        f"{len(question_topics)} tópicos · {variant_count} variantes "
        f"-> catálogos de questões e revisões"
    )


if __name__ == "__main__":
    build()
