"""
레시피에 등장하는 재료명 중, 현재 표준 식재료 용어로는 매칭되지 않는 것을 찾아
search_keywords에 추가하는 후보를 생성한다.

- 1단계: RecipeIngredient.name 전부에 대해, 어떤 표준 재료의 확장 용어에도 안 걸리면 "미매칭"
- 2단계: 미매칭 이름과 표준 재료 name(정규화) 사이에 부분 포함 관계가 있으면 그 표준에 키워드로 추가
- 후보가 여러 개면 표준 name이 더 긴 쪽(구체적)을 우선

사용 예:

    python manage.py enrich_search_keywords --dry-run
    python manage.py enrich_search_keywords --apply
    python manage.py enrich_search_keywords --dry-run --unmapped-csv /tmp/unmapped.csv
"""

from __future__ import annotations

import csv

from django.core.management.base import BaseCommand

from fridges.ingredient_matching import (
    expand_standard_ingredient_terms,
    merge_search_keywords_field,
    normalize_ingredient_name,
    pick_standards_by_substring_overlap,
    recipe_line_matches_any_term,
)
from fridges.models import StandardIngredient
from recipes.models import RecipeIngredient


class Command(BaseCommand):
    help = (
        "RecipeIngredient 이름을 스캔해 StandardIngredient.search_keywords 보강 후보를 "
        "만든다. 기본은 --dry-run (DB 반영 없음)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="DB에 search_keywords를 실제 반영한다. 생략 시 출력만(드라이런).",
        )
        parser.add_argument(
            "--unmapped-csv",
            metavar="PATH",
            help="자동 매핑 실패(표준 부분포함 후보도 없음) 재료명을 CSV 한 줄에 하나씩 저장.",
        )

    def handle(self, *args, **options):
        apply_db = bool(options["apply"])
        unmapped_csv = options.get("unmapped_csv")

        standards = list(StandardIngredient.objects.all().order_by("id"))
        if not standards:
            self.stdout.write(self.style.WARNING("StandardIngredient 데이터가 없습니다."))
            return

        recipe_names = (
            RecipeIngredient.objects.values_list("name", flat=True)
            .distinct()
            .order_by("name")
        )
        recipe_names = [n for n in recipe_names if n and str(n).strip()]

        additions: dict[int, set[str]] = {}
        unmapped: list[str] = []
        ambiguous_logged = 0

        for raw in recipe_names:
            raw_s = str(raw).strip()
            matched = False
            for si in standards:
                terms = expand_standard_ingredient_terms(si)
                if recipe_line_matches_any_term(raw_s, terms):
                    matched = True
                    break
            if matched:
                continue

            r_norm = normalize_ingredient_name(raw_s)
            candidates = pick_standards_by_substring_overlap(r_norm, standards)
            if not candidates:
                unmapped.append(raw_s)
                continue
            if len(candidates) > 1:
                ambiguous_logged += 1
            chosen = candidates[0]
            additions.setdefault(chosen.pk, set()).add(raw_s)

        # 출력
        self.stdout.write(
            self.style.NOTICE(
                f"스캔한 RecipeIngredient 고유 이름: {len(recipe_names)}개, "
                f"키워드 추가 후보: {len(additions)}개 표준 재료, "
                f"미매핑(수동 검토): {len(unmapped)}개"
            )
        )
        if ambiguous_logged:
            self.stdout.write(
                f"(참고) 부분포함 후보가 2개 이상인 경우 긴 표준명을 우선해 {ambiguous_logged}건 처리함."
            )

        for pk in sorted(additions.keys()):
            si = next(s for s in standards if s.pk == pk)
            new_kw = sorted(additions[pk])
            self.stdout.write(f"  [id={pk}] {si.name!r} ← {len(new_kw)}개 추가: {', '.join(new_kw[:8])}")
            if len(new_kw) > 8:
                self.stdout.write(f"      ... 외 {len(new_kw) - 8}개")

        if unmapped_csv and unmapped:
            with open(unmapped_csv, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["recipe_ingredient_name"])
                for u in sorted(set(unmapped)):
                    w.writerow([u])
            self.stdout.write(self.style.WARNING(f"미매핑 목록 저장: {unmapped_csv} ({len(set(unmapped))}행)"))

        if not apply_db:
            self.stdout.write(
                self.style.SUCCESS(
                    "Dry-run 끝. DB 반영하려면 동일 명령에 --apply 를 붙이세요."
                )
            )
            return

        updated = 0
        for pk, new_set in additions.items():
            si = StandardIngredient.objects.get(pk=pk)
            old = si.search_keywords or ""
            merged = merge_search_keywords_field(old, new_set)
            if merged != old.strip() and merged != old:
                si.search_keywords = merged
                si.save(update_fields=["search_keywords"])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"적용 완료: {updated}개 StandardIngredient 갱신."))
