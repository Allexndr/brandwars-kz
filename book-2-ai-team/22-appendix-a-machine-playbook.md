# Приложение A. Машиночитаемый playbook

*Коротко. Ниже — данные для парсера и для агента. YAML-блоки самодостаточны. Комментарии `#` допустимы. Не смешивайте с прозой при загрузке: копируйте fenced-блоки.*
*Источник истины номеров глав — `book-1-guidebook/00-toc.md` и `book-2-ai-team/00-toc.md`. Если YAML и toc разошлись, побеждает toc, YAML чинить (Книга 2, Глава 18, раздел 18.5).*
*Агент: при старте прочитай это приложение или `playbook.yaml`, собранный из блоков. Человек: не редактируйте приоритеты вслепую.*

Проза этого приложения не является схемой. Схема — только блоки `yaml`.

## A.1. Таблица маршрутизации в формате YAML

```yaml
playbook:
  id: meganet-ai-team
  book1: "Книга 1. Продукт мирового уровня"
  book2: "Книга 2. AI-команда"
  version_field: product-state.playbook_version
  citation_format: "Книга 1, Глава {n}, раздел {n.m}"
  always_open_anchors:
    - { book: 1, chapter: 2, sections: ["2.1", "2.2", "2.6"] }
    - { book: 1, chapter: 3, sections: ["3.4"] }
    - { book: 1, chapter: 9, sections: ["9.8", "9.6"] }
  max_full_chapters_loaded: 7
  routing_principle: classify_then_solve

triggers:
  - id: new_product
    match: ["сделай продукт", "есть идея", "задумка", "с нуля", "клон"]
    stage: discovery
    book1_chapters: [4, 5, 6]
    checklists: ["5.8", "A.1"]
    artifacts: ["problem_statement", "hypotheses", "pr_faq_lite"]
    roles: ["orchestrator", "pm", "strategist", "critic"]
    forbid: ["implementation_first"]

  - id: architecture
    match: ["как устроить", "нарисуй систему", "архитектура", "микросервисы"]
    stage: architecture
    gate_in: "6.7"
    book1_chapters: [9, 10, 13]
    checklists: ["9.8", "10.8", "A.2"]
    artifacts: ["napkin", "rfc", "adr_style"]
    roles: ["orchestrator", "architect", "security", "critic"]

  - id: stack
    match: ["стек", "язык", "база", "postgres", "облако", "kubernetes"]
    stage: architecture
    book1_chapters: [16, 9, 18, 24]
    checklists: ["16.8", "9.8"]
    artifacts: ["adr_stack", "cost_note"]
    roles: ["architect", "critic"]

  - id: implement
    match: ["реализуй", "напиши код", "сделай PR", "почини баг"]
    stage: implementation
    gate_in: "7.7"
    book1_chapters: [17, 18, 19, 20, 23, 31]
    checklists: ["31.10", "8.6"]  # 8.6 = Книга 2
    artifacts: ["diff", "tests", "changelog_session"]
    roles: ["engineer", "qa", "critic"]

  - id: security
    match: ["логин", "регистрация", "auth", "безопасность", "IDOR"]
    stage: quality_security
    book1_chapters: [32, 33]
    extra_if_ugc: [34]
    checklists: ["32.11", "33.9"]
    artifacts: ["threat_model"]
    roles: ["security", "qa", "critic"]

  - id: release
    match: ["релиз", "выкати", "можно в прод", "launch"]
    stage: quality_security
    book1_chapters: [23, 25, 31, 32, 33]
    checklists: ["23.9", "25.8", "32.11", "33.9", "A.4", "A.5", "A.6"]
    artifacts: ["launch_plan", "rollback", "slo_draft"]
    roles: ["qa", "security", "privacy", "sre", "critic"]

  - id: growth
    match: ["нужны пользователи", "реклама", "канал", "вирус"]
    stage: launch_growth
    book1_chapters: [28, 37, 39, 7]
    checklists: ["28.9", "39.10", "A.8"]
    artifacts: ["metric_tree", "experiment_plan"]
    roles: ["growth", "pm", "sre", "critic"]
    forbid_if: "incident_active"

  - id: incident
    match: ["прод лежит", "5xx", "инцидент", "платежи не проходят"]
    stage: operations_scale
    book1_chapters: [26, 12, 43]
    checklists: ["A.9"]
    artifacts: ["incident_notes", "status_draft", "postmortem"]
    roles: ["sre", "engineer", "critic"]
    forbid: ["growth_parallel", "architecture_rewrite"]

  - id: ai_feature
    match: ["LLM", "чат-агент", "RAG", "добавь ИИ"]
    stage: architecture
    book1_chapters: [30, 22, 32, 33]
    checklists: ["30.10", "A.7"]
    artifacts: ["ai_boundary", "evals", "token_cost"]
    roles: ["architect", "security", "economist", "qa", "critic"]

  - id: payments
    match: ["платежи", "подписка", "биллинг", "выплаты"]
    book1_chapters: [40, 32, 33, 17]
    checklists: ["40.8"]
    artifacts: ["payments_schema"]
    roles: ["architect", "security", "engineer", "critic"]
    stop_if_book1_missing_40: true

  - id: public_api
    match: ["публичный API", "внешний API", "SDK"]
    book1_chapters: [14, 32, 22]
    checklists: ["14.8"]
    artifacts: ["api_contract"]
    roles: ["architect", "security", "critic"]

  - id: mobile
    match: ["iOS", "Android", "стор", "мобилка"]
    book1_chapters: [20, 36]
    checklists: ["20.8"]
    roles: ["engineer", "qa", "critic"]

  - id: realtime
    match: ["realtime", "коллаб", "чат", "видео", "игра"]
    book1_chapters: [21, 13]
    checklists: ["21.8"]
    roles: ["architect", "engineer", "critic"]

  - id: data
    match: ["аналитика", "события", "warehouse", "ETL"]
    book1_chapters: [18, 27, 28]
    checklists: ["27.8"]
    roles: ["engineer", "pm", "critic"]

  - id: migration
    match: ["миграция", "смена стораджа", "переезд"]
    book1_chapters: [15, 18]
    checklists: ["15.7"]
    artifacts: ["migration_plan"]
    roles: ["architect", "sre", "engineer", "critic"]

  - id: ux
    match: ["онбординг", "экран", "пустое состояние", "a11y"]
    book1_chapters: [35, 37, 36]
    checklists: ["35.9", "37.8"]
    roles: ["ux", "pm", "critic"]

  - id: infra
    match: ["инфра", "платформа", "terraform", "k8s"]
    book1_chapters: [24, 9]
    checklists: ["24.10"]
    roles: ["architect", "sre", "critic"]

  - id: org
    match: ["найм", "команда", "процесс", "роли людей"]
    book1_chapters: [8, 41, 42]
    checklists: ["8.12"]
    roles: ["orchestrator"]
    note: "агент не нанимает"

  - id: book_silent
    match: []
    action: mark_outside_book
    require: ["range_or_question"]
    forbid: ["fake_citation"]

conflict_rules:
  - id: constraints_over_growth_chapter
    wins: "product-state.constraints"
    loses: "book1_chapter_11_sharding_by_default"
  - id: safety_over_feature_speed
    wins: ["book1_32", "book1_33", "law"]
    loses: ["book1_37_short_onboarding"]
  - id: economics_over_paid_channel
    wins: "book1_7"
    loses: "book1_39_without_unit_econ"
  - id: overlay_over_book
    wins: "overlay.project"
    loses: "book1_default"
    except: ["law", "harm_forbid"]
```

## A.2. Определения этапов, гейтов и артефактов

```yaml
stages:
  - id: discovery
    order: 1
    book2: "6"
    inputs: ["human_idea"]
    outputs: ["problem_statement", "hypotheses"]
    gate_out: "6.7"
  - id: strategy
    order: 2
    book2: "6"
    outputs: ["positioning", "econ_lite"]
    gate_out: "6.7"
  - id: architecture
    order: 3
    book2: "7"
    gate_in: "6.7"
    outputs: ["napkin", "rfc", "adr"]
    gate_out: "7.7"
  - id: delivery_plan
    order: 4
    book2: "8"
    gate_in: "7.7"
    outputs: ["roadmap", "cut_list", "iteration_plan"]
  - id: implementation
    order: 5
    book2: "8"
    outputs: ["diff", "tests", "changelog_session"]
  - id: quality_security
    order: 6
    book2: "9"
    outputs: ["test_plan", "threat_model", "slo_draft"]
    gate_out: "9.7"
  - id: launch_growth
    order: 7
    book2: "10"
    gate_in: "9.7"
    outputs: ["launch_plan", "experiment_plan"]
  - id: operations_scale
    order: 8
    book2: "10"
    outputs: ["runbook", "incident_notes", "postmortem", "scale_plan"]

gates:
  - id: "6.7"
    name: "нельзя в архитектуру"
    red_if:
      - empty_problem
      - empty_audience
      - no_constraints_at_all
    skip: "human_recorded_in_yaml.risks"
  - id: "7.7"
    name: "нельзя в толстый код"
    red_if:
      - no_napkin
      - style_incompatible_with_headcount
      - no_threat_page_on_public_entry
    skip: "human_recorded"
  - id: "9.7"
    name: "нельзя релизить"
    red_if:
      - no_test_strategy
      - no_observability
      - no_rollback
      - security_checklist_unrun
      - idor_untested_public
    skip: "human_recorded; do_not_call_safe"
  - id: "13.9"
    name: "безопасная автономия инструментов"
    red_if:
      - lethal_trifecta_assembled
      - prod_without_confirm
      - secrets_in_diff
  - id: "16.8"
    name: "самопроверка выдачи"
    red_if:
      - fake_green_tests
      - critic_without_three_checks
      - citation_not_in_toc

artifacts:
  problem_statement: { dir: "docs/prd", required_fields: ["who", "job", "workaround", "done_when"] }
  hypotheses: { dir: "docs/prd", required_fields: ["statement", "test", "status"] }
  pr_faq_lite: { dir: "docs/prd" }
  napkin: { dir: "docs/rfc", required_fields: ["rps_order", "data_order", "cost_order"] }
  rfc: { dir: "docs/rfc", status: ["draft", "review", "accepted", "deprecated"] }
  adr: { dir: "docs/adr", file: "NNNN-slug.md", statuses: ["proposed", "accepted", "superseded"] }
  threat_model: { dir: "docs/security", required_fields: ["actors", "assets", "controls"] }
  test_plan: { dir: "docs/qa" }
  slo_draft: { dir: "docs/sre", required_fields: ["sli", "source_or_unmeasured"] }
  runbook: { dir: "docs/sre" }
  postmortem: { dir: "docs/sre", required_fields: ["timeline", "actions_with_owners"] }
  launch_plan: { dir: "docs/plans", required_fields: ["rollback"] }
  experiment_plan: { dir: "docs/plans", required_fields: ["hypothesis", "guardrail"] }
  iteration_plan: { dir: "docs/plans", required_fields: ["v1", "cut", "done_when"] }
  product_state: { file: "product-state.md", schema: "book2_ch3" }
  overlay: { file: "docs/playbook-overlay.md" }
```

## A.3. Реестр ролей в структурированном виде

```yaml
roles:
  orchestrator:
    entry: "any_message"
    zone: "classify, stage, gates, state"
    book2: [3, 4, 5]
    artifact: "product-state.md"
    exit: "stage_and_roles_named"
  pm:
    entry: ["idea", "feature", "priority", "deadline"]
    book1: [5, 38, 4]
    artifact: ["problem_statement", "prd", "iteration_plan"]
    exit: "observable_done_when"
  strategist:
    entry: ["market", "price", "channel"]
    book1: [4, 6, 7, 39]
    artifact: ["not_this", "econ_lite"]
    exit: "bet_or_refuse_to_invent_numbers"
  architect:
    entry: "gate_6_7_not_red"
    book1: [9, 10, 11, 12, 13, 14, 15, 16, 18]
    artifact: ["rfc", "adr", "napkin"]
    exit: "gate_7_7"
  engineer:
    layers: ["backend", "frontend", "mobile", "data"]
    book1: [17, 18, 19, 20, 21, 23, 27]
    artifact: ["diff", "tests"]
    exit: "book2_8_6"
  qa:
    book1: [31]
    artifact: ["test_plan"]
    exit: "risk_to_test_table"
  security:
    entry: ["public_entry", "files", "payments", "ai_tools", "release"]
    book1: [32, 30]
    artifact: ["threat_model"]
    exit: "no_plain_idor; no_secrets_in_git"
  privacy:
    book1: [33]
    artifact: ["data_inventory"]
    exit: "not_legal_stamp"
  sre:
    book1: [25, 26, 12]
    artifact: ["runbook", "slo_draft", "incident_notes"]
    exit: "eyes_on_prod"
  growth:
    book1: [28, 37, 39]
    artifact: ["launch_plan", "experiment_plan"]
    exit: "no_paid_channel_while_blind"
  ux:
    book1: [35, 36, 37]
    artifact: ["screen_checklist"]
    exit: "empty_and_error_states"
  economist:
    book1: [7, 22, 30]
    artifact: ["cost_note"]
    exit: "order_of_magnitude_or_refuse"
  critic:
    entry: "any_gate_artifact"
    book2: [16]
    artifact: "red_list"
    exit: "three_checks_or_three_holes"
    forbid: "authoring_new_stack"

task_role_matrix:
  new_product: ["orchestrator", "pm", "strategist", "critic"]
  architecture: ["orchestrator", "architect", "security", "critic"]
  code_change: ["orchestrator", "engineer", "qa", "critic"]
  release: ["orchestrator", "qa", "security", "privacy", "sre", "critic"]
  incident: ["orchestrator", "sre", "engineer", "critic"]
  ai_feature: ["orchestrator", "architect", "security", "economist", "qa", "critic"]
  growth: ["orchestrator", "growth", "pm", "sre", "critic"]
  typo: ["engineer"]
```

## A.4. Чек-листы в машиночитаемом формате

```yaml
checklists:
  start_session:
    chapter: "20.1"
    items:
      - id: books_loaded
      - id: state_from_disk
      - id: stage_named
      - id: route_4_2
      - id: roles_11_3
      - id: repo_root
      - id: trifecta_broken
  discovery:
    chapter: "20.2"
    gate: "6.7"
    items:
      - id: problem_four_fields
      - id: audience_not_everyone
      - id: not_this
      - id: hypothesis_testable
      - id: no_invented_tam
      - id: no_code_on_red
  architecture:
    chapter: "20.3"
    gate: "7.7"
    items:
      - id: napkin
      - id: style_fits_10_5
      - id: isolation_key
      - id: threat_page
      - id: degradation
      - id: alternatives
  before_code:
    chapter: "20.4"
    items:
      - id: slice_cut_done_when
      - id: file_boundary
      - id: invariant_test_planned
      - id: no_secrets
      - id: one_writer
  release:
    chapter: "20.5"
    gate: "9.7"
    items:
      - id: idor_test_logged
      - id: rollback
      - id: observability_or_unmeasured
      - id: human_confirm_prod
      - id: ai_evals_if_llm
      - id: payments_idempotent_if_money
  after_launch:
    chapter: "20.6"
    items:
      - id: events_actually_fire
      - id: no_growth_during_5xx
      - id: postmortem_to_overlay
  background:
    chapter: "20.7"
    every_significant_turn: true
    items:
      - id: access_control
      - id: privacy_field
      - id: timeouts
      - id: cost_path
      - id: oncall_owner
      - id: toc_citations_live
      - id: tests_run_or_honest
  autonomy:
    chapter: "13.9"
    items:
      - id: command_bucket_classified
      - id: blast_radius_named
      - id: rollback_named
      - id: untrusted_not_instruction
  compact_prompt: "20.8"

stop_conditions:
  - irreversible_without_human
  - high_cost_missing_data
  - law_or_safety_conflict
  - unknowable_unverified
  - three_failed_attempts
  - lethal_trifecta
  - no_repo_root
  - confirm_bucket_human_absent
  - partial_book_on_gate
  - incident_without_human_ic

command_buckets:
  auto: ["test", "lint", "build", "git_status", "git_diff", "git_log", "grep"]
  confirm: ["deploy", "migrate_non_local", "delete_data", "publish", "pay", "email_users", "git_push_shared", "loadtest_shared"]
  forbid: ["rm_rf_outside_tmp", "git_push_force", "git_reset_hard", "git_no_verify", "prod_sql_unbounded", "curl_pipe_sh", "exfiltrate_secrets"]
```

Конец машиночитаемой части. Прозаические главы 4, 5, 11, 13, 20 остаются нормативным комментарием к этим полям.
