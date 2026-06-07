# public/ — 정적 파일

빌드 시 사이트 루트(`/`)에 그대로 올라간다. **두 갈래로 나눠 둔다:**

- **루트 직속 = 앱 외부 자산** — 브라우저·OS·SNS가 **고정 주소로** 요청. 이름·경로가 바뀌면 깨지므로 루트에 둔다.
- **`assets/` = 앱 내부 자산** — 앱 코드가 쓰는 일러스트·아이콘. 용도별로 나눈다.
  - `assets/illust/` — 일러스트·플레이스홀더 (예: `avatar-placeholder.webp`, `portrait-placeholder.webp`)
  - `assets/icon/` — 파일형 아이콘 (UI 아이콘은 대개 lucide-react, FIRE EMBLEM 로고는 `src/Logo.tsx` 인라인 SVG)
  - 코드에서 `/assets/illust/…`, `/assets/icon/…` 경로로 부른다. (현재 참조: `src/Characters.tsx`의 `HERO_PLACEHOLDER`·`LIST_PLACEHOLDER`)

⚠️ **에셋 원칙(CLAUDE.md §6)**: 캐릭터 일러스트 등 큰 에셋은 여기 두지 말고 **Supabase Storage**에 둔다. `assets/`는 앱 전반에서 쓰는 공용 UI 이미지(플레이스홀더·장식·아이콘)용.

---

## 외부 자산 (루트 직속 — 이름·크기 고정)

| 파일명 | 크기 | 용도 |
|---|---|---|
| `favicon.ico` | 16·32·48 멀티 | 브라우저 탭 아이콘 |
| `favicon-32x32.png` | 32×32 | 탭 아이콘(고해상) |
| `favicon-16x16.png` | 16×16 | 탭 아이콘(저해상) |
| `apple-touch-icon.png` | **180×180** | 아이폰 홈 화면(웹앱) 아이콘 — 투명 배경 없이 꽉 찬 정사각(iOS가 모서리를 알아서 둥글림) |
| `icon-192.png` | 192×192 | 안드로이드/PWA (선택) |
| `icon-512.png` | 512×512 | 안드로이드/PWA·매니페스트 (선택) |
| `og-image.png` | **1200×630** | 링크 미리보기(카톡·디스코드·트위터 등) |
| `site.webmanifest` | — | PWA 매니페스트 |

- 파란 크레스트 아이콘 → `apple-touch-icon.png` / `icon-512.png` / `favicon.ico` 원본으로.
- 흑백 엠블럼(1200×630) → `og-image.png` 로.
- 위 표의 이름과 **한 글자도 다르면 안 된다**(`index.html`·매니페스트가 그 이름을 가리킨다).

## 참고
- iOS '홈 화면에 추가'는 `apple-touch-icon.png`만 있으면 된다(매니페스트 불필요).
- 안드로이드 PWA 아이콘만 `icon-192/512`가 필요(없으면 그 부분만 비고, iOS·탭·OG는 멀쩡).
