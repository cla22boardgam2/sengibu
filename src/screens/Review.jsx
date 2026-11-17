import { useState } from "react";
import { useApp } from "../state.jsx";
import { draftKeyOf } from "../lib/materials.js";
import { toRealNames, scrubNames } from "../lib/students.js";
import { patchDraft, saveDraft, hasStudentId } from "../lib/drafts.js";
import { generateOne } from "../lib/provider.js";
import { useSectionPicker } from "../components/SectionPicker.jsx";
import ByteCounter from "../components/ByteCounter.jsx";
import { Button, Notice, EmptyHint } from "../components/ui.jsx";

const NEED_SPLIT = /(\[보충 필요[^\]]*\]?)/;
const hasNeed = (t) => String(t ?? "").includes("[보충 필요");

function Highlighted({ text }) {
  const parts = String(text).split(NEED_SPLIT);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("[보충 필요") ? (
          <mark key={i} data-testid="need-more" className="bg-red-100 text-red-700 rounded px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function DraftCard({ st, entry, state, section, opts, keyName, update }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const shown = toRealNames(entry.draft, state.students);

  const edit = (value) =>
    update((s) => patchDraft(s, st.pseudoId, keyName, { draft: scrubNames(value, s.students).text, reviewed: false }));

  const regenerate = async () => {
    if (entry.reviewed && !window.confirm("검토 완료한 초안을 새로 쓸까요?")) return;
    setBusy(true);
    setNote("");
    try {
      const result = await generateOne(state, st.pseudoId, section, opts);
      update((s) => saveDraft(s, st.pseudoId, keyName, result));
    } catch (err) {
      setNote(err.status === 429 ? "무료 한도에 걸렸어요. 잠시 뒤 다시 눌러 주세요." : `다시 쓰지 못했어요: ${err.message}`);
    }
    setBusy(false);
  };

  const copy = async () => setNote((await copyText(entry.draft)) ? "복사했어요." : "복사가 안 돼요. 초안 칸에서 직접 복사해 주세요.");

  return (
    <section aria-label={`${st.number}번 학생 초안`} className="bg-white border border-stone-200 rounded-xl p-4 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="font-semibold">{st.number}. {st.name}</div>
        <div className="flex items-center gap-3">
          <ByteCounter text={entry.draft} state={state} section={section} />
          {state.settings.geminiKey && (
            <Button variant="ghost" onClick={regenerate} disabled={busy}>{busy ? "쓰는 중…" : "다시 생성"}</Button>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_18rem] gap-4">
        <div>
          <textarea aria-label="초안" value={shown} onChange={(e) => edit(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm h-36 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          {hasNeed(entry.draft) && (
            <div className="mt-1 border border-red-200 rounded-lg p-2 bg-red-50/40"><Highlighted text={shown} /></div>
          )}
          {hasStudentId(entry.draft) && (
            <div className="mt-2"><Notice tone="error">초안에 학생 이름이나 ID가 들어 있어요. 생기부 문장에는 이름을 쓰지 않으니 지워 주세요.</Notice></div>
          )}
          <div className="flex items-center justify-between mt-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" aria-label="검토 완료" checked={!!entry.reviewed}
                onChange={(e) => update((s) => patchDraft(s, st.pseudoId, keyName, { reviewed: e.target.checked }))} />
              검토 완료
            </label>
            <div className="flex items-center gap-2">
              {note && <span className="text-xs text-stone-500">{note}</span>}
              <Button onClick={copy} disabled={!entry.reviewed}>복사</Button>
            </div>
          </div>
        </div>
        <aside className="text-xs space-y-3">
          {entry.warnings?.length > 0 && (
            <div>
              <div className="font-semibold text-amber-700 mb-1">확인할 점</div>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-900">{entry.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {entry.missing?.length > 0 && (
            <div>
              <div className="font-semibold text-stone-700 mb-1">보충하면 좋을 관찰</div>
              <ul className="list-disc pl-4 space-y-0.5">{entry.missing.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {entry.evidence?.length > 0 && (
            <div>
              <div className="font-semibold text-stone-700 mb-1">문장별 근거</div>
              <ul className="space-y-1.5">
                {entry.evidence.map((e, i) => (
                  <li key={i} className="border-l-2 border-emerald-300 pl-2">
                    <div>{toRealNames(e.sentence, state.students)}</div>
                    <div className="text-stone-500">← {toRealNames(e.source, state.students)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function Review() {
  const { state, update, goTo } = useApp();
  const { section, opts, ready, picker } = useSectionPicker(state);
  const keyName = draftKeyOf(section, opts);
  const [note, setNote] = useState("");

  const withDraft = state.students.filter((s) => state.drafts[s.pseudoId]?.[keyName]);
  const reviewed = withDraft.filter((s) => state.drafts[s.pseudoId][keyName].reviewed);

  const copyAll = async () => {
    const text = reviewed.map((s) => `${s.number}\t${state.drafts[s.pseudoId][keyName].draft}`).join("\n");
    setNote((await copyText(text)) ? `${reviewed.length}명 복사했어요 (번호, 탭, 초안 순).` : "복사가 안 돼요.");
  };

  return (
    <>
      {picker}
      {!ready ? (
        <EmptyHint action={<Button onClick={() => goTo("설정")}>설정으로 가기</Button>}>설정에서 평가계획을 먼저 넣어 주세요.</EmptyHint>
      ) : withDraft.length === 0 ? (
        <EmptyHint action={<Button onClick={() => goTo("초안 만들기")}>초안 만들러 가기</Button>}>이 항목은 아직 초안이 없어요.</EmptyHint>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-sm text-stone-600">초안 {withDraft.length}명 · 검토 완료 {reviewed.length}명</span>
            <Button variant="ghost" onClick={copyAll} disabled={reviewed.length === 0}>검토 완료된 것 번호순 모두 복사</Button>
            {note && <span className="text-xs text-stone-500">{note}</span>}
          </div>
          {withDraft.map((st) => (
            <DraftCard key={st.pseudoId} {...{ st, state, section, opts, keyName, update }} entry={state.drafts[st.pseudoId][keyName]} />
          ))}
        </>
      )}
    </>
  );
}
