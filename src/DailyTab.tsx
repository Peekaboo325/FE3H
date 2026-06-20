// 일상(日常) 탭 — 인물의 '살아 있는 나날'. 일지를 엎고 그 자리를 대체한다(설계 docs/일상_설계.md).
//  자립 기둥: 연료를 '턴'이 아니라 인물 프로필·세계·관계·정사에서 가져온다 → Opus 꺼져도, 본문이 백지여도 논다.
//  화면 = 3구획(§11): [거처 삽화 — 스킨] / [근황(안색·지갑) + 격려·조달·육성 버튼] / [활동 로그 — 심장].
//  ⚠️ 가림 판정은 '자기칸'(daily.setup_at)으로만 — analysis 통째 truthy로 보지 말 것(§14 빈화면 버그 교훈).
//  0단계 = 껍데기(빈 골격). 능력·경제·상태·로그·버튼은 단계별로 채운다.
import type { CharReport } from './useCharacters';

export default function DailyTab({ report }: { report?: CharReport | null }) {
  const daily = report?.daily;
  const ready = !!daily?.setup_at; // 빌더가 세팅 면을 한 번 깔았는가(시작 등급·특성·수입·관계)

  // 세팅 후 골격(3구획) — 내용은 단계별로 채운다. 흐릿하게 깔거나 실제로 보여주는 데 공용.
  const skeleton = (
    <div className="daily">
      <div className="daily-skin" />
      <div className="daily-status" />
      <div className="daily-log" />
    </div>
  );

  // 세팅 전 — 빌더가 직접 시작 등급·특성·수입 등급·관계 태그를 깔아야 일상이 돈다(0-C 세팅 면).
  //  (세팅 면 버튼은 0-C에서 이 자리에 들어온다.)
  if (!ready) {
    return (
      <div className="report-locked">
        <div className="report--ghost" aria-hidden="true">
          {skeleton}
        </div>
        <div className="report-lock-overlay">
          <p className="report-lock-msg">아직 일상이 깃들지 않았습니다.</p>
        </div>
      </div>
    );
  }

  return skeleton;
}
