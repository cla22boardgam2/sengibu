import { useEffect, useRef } from "react";
import { useApp } from "../state.jsx";

// 앱 안 사용 설명서. 버튼 이름은 화면에 실제로 보이는 글자와 맞춘다.
function B({ children }) {
  return <span className="inline-block rounded-md border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[0.85em] font-medium text-stone-800 whitespace-nowrap">{children}</span>;
}

function Steps({ items }) {
  return (
    <ol className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
          <div className="text-sm leading-relaxed text-stone-700">{t}</div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children, tone = "info" }) {
  const cls = tone === "warn" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900";
  return <div className={`border rounded-lg px-3 py-2 text-sm mt-3 ${cls}`}>{children}</div>;
}

const SECTIONS = [
  ["start", "처음 준비"],
  ["ways", "AI로 쓰는 세 가지 방법"],
  ["api", "무료 API 키로 자동 쓰기"],
  ["batch", "여러 명 한 번에 복사하기"],
  ["one", "한 명씩 복사하기"],
  ["input", "학생별로 입력하기"],
  ["review", "검토하고 나이스에 옮기기"],
  ["backup", "백업과 다른 컴퓨터에서 쓰기"],
  ["faq", "자주 묻는 질문"],
];

function Section({ id, title, children }) {
  return (
    <section id={`guide-${id}`} className="bg-white border border-stone-200 rounded-xl p-5 mb-4 scroll-mt-20">
      <h2 className="font-semibold text-stone-800 text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function Guide({ focus }) {
  const { goTo } = useApp();
  const root = useRef(null);
  const jump = (id) => root.current?.querySelector(`#guide-${id}`)?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  useEffect(() => {
    if (focus?.value) setTimeout(() => jump(focus.value), 0);
    else if (focus) window.scrollTo?.(0, 0);
  }, [focus]);
  const T = Object.fromEntries(SECTIONS);
  const link = (tab, label, value) => (
    <button type="button" className="text-emerald-700 underline" onClick={() => goTo(tab, value)}>{label}</button>
  );

  return (
    <section aria-label="사용법" ref={root}>
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
        <h1 className="font-bold text-xl text-stone-800">사용법</h1>
        <p className="text-sm text-stone-500 mt-1">처음 쓰시는 선생님은 위에서부터 차례대로 읽어 보세요. 10분이면 첫 초안까지 갈 수 있어요.</p>
        <nav aria-label="사용법 차례" className="mt-3 grid sm:grid-cols-3 gap-1.5">
          {SECTIONS.map(([id, title], i) => (
            <button key={id} type="button" onClick={() => jump(id)}
              className="text-left text-sm rounded-lg border border-stone-200 px-3 py-1.5 hover:bg-stone-50">
              <span className="text-stone-400 mr-1.5">{i + 1}</span>{title}
            </button>
          ))}
        </nav>
      </div>

      <Section id="start" title={T.start}>
        <p className="text-sm text-stone-600 mb-3">맨 위 <B>홈</B>의 "시작 준비" 목록을 위에서부터 채우면 돼요. 각 줄의 <B>하러 가기</B>를 누르면 그 자리로 바로 가요.</p>
        <Steps items={[
          <><b>학생 명단</b> (필수): <B>학생</B> 메뉴에서 명렬표의 이름 칸을 복사해 붙여넣고 <B>학생 추가</B>. 학생마다 S01, S02 같은 가명이 붙어요. AI에는 이 가명만 보내요.</>,
          <><b>기재요령 발췌</b> (필수): 기재 길라잡이에서 평어·창체·행발 쓰는 법과 유의사항 부분만 복사해 붙여넣어요. AI가 가장 먼저 따르는 기준이에요. 너무 길면 AI 사용량이 늘어나니 꼭 필요한 부분만 넣어요.</>,
          <><b>바이트 상한</b> (필수): 나이스 글자 수 제한이에요. 한글 1자 = 3바이트라서 500자 제한이면 1500을 넣어요.</>,
          <><b>평가계획</b> (교과 평어를 쓸 때만): <B>양식 내려받기</B>로 엑셀 양식을 받아 학교 평가계획을 칸에 맞게 옮긴 뒤 <B>엑셀 올리기</B> → <B>평가계획 읽기</B>.</>,
          <><b>행사 목록</b> (창체를 쓸 때만): 영역 · 행사 이름 · 짧은 설명을 넣어요. AI는 이 목록에 있는 행사만 써요.</>,
          <><b>AI 연결</b> (선택): 무료 API 키를 넣으면 버튼 한 번으로 써요. 없어도 복사·붙여넣기로 쓸 수 있어요. 아래 2번을 보세요.</>,
        ]} />
      </Section>

      <Section id="ways" title={T.ways}>
        <p className="text-sm text-stone-600 mb-3">AI가 문장을 쓰게 하는 방법은 세 가지예요. 모두 돈이 들지 않아요.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-2 pr-3 font-medium">방법</th><th className="py-2 pr-3 font-medium">이럴 때 좋아요</th><th className="py-2 pr-3 font-medium">아쉬운 점</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-stone-100">
                <td className="py-2 pr-3 font-medium">① 무료 API 키로 자동</td>
                <td className="py-2 pr-3">버튼 한 번으로 반 전체를 알아서 써 줘요.</td>
                <td className="py-2 pr-3">무료 한도가 적어서 하루에 많이 쓰면 막혀요.</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-2 pr-3 font-medium">② 여러 명 한 번에 복사 <span className="text-emerald-700">(추천)</span></td>
                <td className="py-2 pr-3">쓰시는 AI 채팅(Gemini·ChatGPT·Claude)에 붙여넣어요. 유료 구독 중이면 한도 걱정이 거의 없어요.</td>
                <td className="py-2 pr-3">붙여넣기를 몇 번 해야 해요. 25명이면 3번쯤.</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">③ 한 명씩 복사</td>
                <td className="py-2 pr-3">한 학생만 다시 쓰고 싶을 때.</td>
                <td className="py-2 pr-3">반 전체를 쓰기엔 번거로워요.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Tip>
          <b>API 키가 뭔가요?</b> 앱이 AI를 직접 부를 수 있게 해 주는 "열쇠"예요. 구글이 무료로 만들어 줘요.
          Gemini·ChatGPT·Claude의 채팅 구독(유료 계정)은 채팅 화면에서만 쓰는 이용권이라 앱에 직접 연결할 수 없어요. 구독을 활용하려면 ② 방법을 쓰세요.
        </Tip>
      </Section>

      <Section id="api" title={T.api}>
        <h3 className="font-medium text-stone-800 mb-2">키 만들기 (처음 한 번)</h3>
        <Steps items={[
          <>{link("설정", "설정", "ai")} → <b>AI 연결 (무료)</b>의 <B>무료 API 키 만들기 (Google AI Studio)</B> 링크를 눌러요.</>,
          <>구글 계정으로 로그인해요. 학교 계정에서 막히면 개인 Gmail로 하세요.</>,
          <><B>Create API key</B>를 누르고, 프로젝트를 고르라고 하면 아무거나 골라요. 결제나 카드 등록 화면이 나와도 건너뛰세요. 카드를 넣지 않으면 돈이 나가지 않아요.</>,
          <>나온 키(AIza로 시작)를 복사해 앱의 <b>API 키</b> 칸에 붙여넣어요. 저장 버튼은 없어요. 넣는 즉시 이 브라우저에만 저장돼요.</>,
        ]} />
        <Tip tone="warn">키는 비밀번호처럼 다뤄 주세요. 다른 사람에게 보내거나 채팅에 붙여넣지 마세요. 백업 파일에도 들어가지 않아요.</Tip>
        <h3 className="font-medium text-stone-800 mt-5 mb-2">반 전체 쓰기</h3>
        <Steps items={[
          <><B>작업</B>에서 항목(교과 평어·창체·행발·통지표)을 골라요.</>,
          <>학생마다 칩·등급·메모를 골라요. 아래 6번 "학생별로 입력하기"를 보세요.</>,
          <>위쪽 막대의 <B>한 요청에 5명</B>을 확인하고 <B>입력된 학생 전체 생성</B>을 눌러요. 5명씩 묶어 보내서 무료 한도를 아껴요.</>,
          <>"7 / 25 완료"처럼 진행률이 보여요. 도중에 <B>멈춤</B>을 눌렀다가 <B>이어서 하기</B>로 계속할 수 있어요.</>,
          <>한 학생만 다시 쓰려면 오른쪽 <B>이 학생 다시 생성</B>을 눌러요.</>,
        ]} />
        <Tip>"무료 사용량 한도에 걸렸어요"가 나오면 앱이 기다렸다가 알아서 이어 가요. 하루 한도를 다 쓰면 다음 날 이어서 하거나, 아래 ② 방법으로 바꾸세요.</Tip>
      </Section>

      <Section id="batch" title={T.batch}>
        <p className="text-sm text-stone-600 mb-3">API 키 없이, 선생님이 쓰시는 AI 채팅으로 여러 학생을 한 번에 써요. API 키가 들어 있으면 작업 화면 위쪽의 <B>복사·붙여넣기로 하기</B>를 체크하면 이 칸이 나와요.</p>
        <Steps items={[
          <><B>작업</B>에서 항목을 고르고, 학생들의 칩·등급·메모를 먼저 골라 둬요.</>,
          <>위쪽 "여러 명 한 번에"에서 인원을 골라요. 처음에는 <B>5명</B>이나 <B>10명</B>을 추천해요.</>,
          <><B>10명 프롬프트 복사</B>를 눌러요. 옆에 "1~10번째 · 대상 25명"처럼 이번 묶음이 보여요.</>,
          <>Gemini(gemini.google.com)·ChatGPT·Claude 중 쓰시는 채팅에서 <b>새 채팅</b>을 열고 붙여넣어요(Ctrl+V).</>,
          <>AI가 [ {"{"} ... {"}"}, {"{"} ... {"}"} ] 모양의 답을 줘요. 답 <b>전체</b>를 복사해요. 답 아래에 있는 복사 버튼을 쓰면 편해요.</>,
          <>앱의 <b>여러 명 답 붙여넣기</b> 칸에 붙여넣고 <B>여러 명 답 저장</B>을 눌러요. 학생별로 나뉘어 저장되고, 다음 묶음으로 넘어가요.</>,
          <>대상 학생이 0명이 될 때까지 3~6번을 반복해요.</>,
        ]} />
        <Tip>"답이 없는 학생: 5번 ○○"이 나오면 AI가 그 학생을 빠뜨린 거예요. 그 학생은 다음 묶음에 다시 들어가요.</Tip>
        <Tip tone="warn">"답에서 JSON 배열을 찾지 못했어요"가 나오면 AI 답이 중간에 끊겼거나 일부만 복사된 거예요. 인원을 5명으로 줄여 다시 해 보세요.</Tip>
      </Section>

      <Section id="one" title={T.one}>
        <Steps items={[
          <><B>작업</B>에서 왼쪽 목록의 학생을 골라요.</>,
          <>오른쪽 초안 칸 아래의 <B>프롬프트 복사</B>를 눌러요.</>,
          <>AI 채팅 <b>새 창</b>에 붙여넣고, 나온 답을 복사해요. 학생마다 새 채팅을 여는 게 좋아요.</>,
          <><b>답 붙여넣기</b> 칸에 넣고 <B>답 저장</B>을 누르면 바로 위에 초안이 떠요.</>,
        ]} />
        <Tip>다른 학생의 답을 붙여넣으면 저장하기 전에 확인을 물어봐요.</Tip>
      </Section>

      <Section id="input" title={T.input}>
        <p className="text-sm text-stone-600 mb-3"><B>작업</B> 화면은 세 칸이에요. 왼쪽은 학생 목록, 가운데는 고른 학생 한 명의 입력, 오른쪽은 그 학생의 초안이에요.</p>
        <Steps items={[
          <>위에서 항목을 골라요. <b>교과 평어</b>는 교과(국어·수학…)까지, <b>창체</b>는 영역까지 골라요.</>,
          <>가운데에서 입력해요. 교과는 평가요소마다 <B>매잘</B> <B>잘함</B> <B>보통</B> <B>노력</B>, 창체는 참여한 행사와 역할 칩, 행발은 분류(성품·학습·친구…)를 펼쳐 칩을 골라요. 통지표는 따로 고를 것 없이 교과 등급과 행발 칩을 모아 써요.</>,
          <>칩으로 안 되는 관찰은 <b>메모</b>에 한 줄씩 적어요. 날짜를 넣으면 순서대로 정리돼요.</>,
          <>대부분 같은 등급이면 <B>반 전체 같은 등급 한 번에 주기</B>를 펼쳐 한 번에 고르고, 다른 학생만 따로 바꿔요.</>,
          <><B>다음 학생 →</B>을 누르거나 키보드 → 키로 넘겨요(← 는 이전 학생).</>,
        ]} />
        <div className="mt-3 text-sm text-stone-700">
          <b>학생 목록 기호</b>
          <ul className="mt-1 grid sm:grid-cols-5 gap-1 text-xs">
            <li><span className="text-stone-400">○</span> 입력 없음</li>
            <li><span className="text-sky-600">◐</span> 입력됨</li>
            <li><span className="text-emerald-600">●</span> 초안 있음</li>
            <li><span className="text-red-600 font-bold">!</span> 보충 필요</li>
            <li><span className="text-emerald-700 font-bold">✓</span> 검토 완료</li>
          </ul>
        </div>
        <Tip tone="warn">"재료가 똑같아요" 알림은 고른 칩·등급·메모가 다른 학생과 완전히 같다는 뜻이에요. 이대로면 문장이 비슷해질 수 있어요. 그 학생만의 모습을 메모로 한 줄 더하면 달라져요.</Tip>
        <Tip>메모에 이름·연락처·건강·가정 정보는 쓰지 마세요. 이름은 혹시 써도 AI에 보내기 전에 가명으로 바꿔 보내요.</Tip>
      </Section>

      <Section id="review" title={T.review}>
        <Steps items={[
          <>오른쪽 <b>초안</b> 칸에서 문장을 읽고 직접 고쳐요. 위의 바이트 수가 빨갛게 바뀌면 상한을 넘은 거예요.</>,
          <>빨간 <b>[보충 필요: …]</b>가 있으면 관찰 기록이 모자란 부분이에요. 메모를 더하고 다시 생성하거나 직접 채워요.</>,
          <>아래 "확인할 점", "문장별 근거"를 보고 사실과 맞는지 확인해요.</>,
          <>다 봤으면 <B>검토 완료</B>를 체크해요. 그래야 <B>복사</B>가 켜져요. 글을 고치면 체크가 다시 풀려요.</>,
          <><B>복사</B>를 눌러 나이스 해당 칸에 붙여넣어요. 위쪽 <B>검토 완료 n명 모두 복사</B>는 번호·탭·초안 순서로 한꺼번에 복사해요(엑셀에 붙여넣기 좋아요).</>,
        ]} />
        <Tip tone="warn">AI 초안은 보조 자료예요. 나이스에 넣기 전에 반드시 선생님이 읽고 고쳐 주세요.</Tip>
      </Section>

      <Section id="backup" title={T.backup}>
        <Steps items={[
          <>자료는 서버가 아니라 <b>지금 쓰는 컴퓨터의 이 브라우저</b>에만 저장돼요. 다른 컴퓨터나 다른 브라우저에서는 보이지 않아요.</>,
          <>{link("백업", "백업")}에서 가끔 백업 파일을 내려받아 두세요. 브라우저 기록을 지우면 자료도 지워질 수 있어요.</>,
          <>다른 컴퓨터에서 이어 하려면 그 컴퓨터에서 앱을 열고 <B>백업</B> → 백업 파일 불러오기를 해요. API 키는 백업에 들어가지 않으니 다시 넣어요.</>,
        ]} />
      </Section>

      <Section id="faq" title={T.faq}>
        <dl className="space-y-3 text-sm">
          {[
            ["Gemini·ChatGPT·Claude 유료 구독을 앱에 연결할 수 있나요?", "아니요. 채팅 구독은 채팅 화면에서만 쓰는 이용권이에요. 대신 ② 여러 명 한 번에 복사로 그 채팅에 붙여넣으면 구독의 넉넉한 한도로 쓸 수 있어요."],
            ["무료 API 키로 돈이 나갈 수 있나요?", "Google AI Studio에서 직접 결제 수단을 연결하지 않으면 나가지 않아요. 한도를 넘으면 돈이 나가는 대신 잠시 막혀요."],
            ["무료 한도에 자주 걸려요.", "한 요청에 5명이나 10명으로 묶어 보내고, 기재요령 발췌를 꼭 필요한 부분만 넣으세요. 그래도 막히면 ② 방법으로 바꾸세요."],
            ["학생 이름이 AI에 가나요?", "아니요. S01 같은 가명만 보내요. 이름과 가명의 대응표는 이 브라우저에만 있어요. 초안 화면에서는 다시 이름으로 보여요."],
            ["동료 선생님과 같이 쓸 수 있나요?", "주소만 알려 주면 돼요. 자료와 API 키는 각자 브라우저에 따로 저장되니 섞이지 않아요. API 키는 각자 만들어 넣어요."],
            ["초안에 S01 같은 글자가 보여요.", "AI가 가명을 문장에 넣은 거예요. 화면에서는 이름으로 바뀌어 보이지만, 생기부 문장에는 이름을 쓰지 않으니 지워 주세요."],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="font-medium text-stone-800">Q. {q}</dt>
              <dd className="text-stone-600 mt-0.5">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </section>
  );
}
