import { useState } from "react";
import { useAppState } from "../state.jsx";
import { exportBackup, importBackup } from "../lib/store.js";
import { Card, Button, Notice } from "../components/ui.jsx";

const today = () => new Date().toISOString().slice(0, 10);

export function downloadText(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export default function Backup() {
  const [state, update] = useAppState();
  const [msg, setMsg] = useState(null);

  const download = () => downloadText(`생기부_백업_${today()}.json`, exportBackup(state));

  const load = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let next;
    try {
      next = importBackup(await readFileText(file), state.settings.geminiKey);
    } catch (err) {
      setMsg({ tone: "error", text: err.message });
      return;
    }
    if (!window.confirm("지금 자료를 백업 파일 내용으로 바꿀까요? 지금 자료는 사라져요.")) return;
    update(() => next);
    setMsg({ tone: "info", text: `불러왔어요. 학생 ${next.students.length}명` });
  };

  const clearAll = () => {
    download();
    if (!window.confirm("백업 파일을 내려받았어요. 학생·입력·초안을 비울까요? 설정·칩·평가계획·행사 목록은 남아요.")) return;
    update((s) => ({ ...s, students: [], nextStudentSeq: 1, inputs: {}, drafts: {} }));
    setMsg({ tone: "info", text: "비웠어요. 새 학년 학생을 넣어 주세요." });
  };

  return (
    <>
      <Card title="백업 내려받기" desc="자료는 이 브라우저에만 있어요. 브라우저 기록을 지우면 사라지니 가끔 내려받아 두세요. API 키는 백업 파일에 넣지 않아요.">
        <Button onClick={download}>백업 내려받기</Button>
      </Card>
      <Card title="백업 불러오기" desc="다른 컴퓨터에서 이어 쓰거나, 지워진 자료를 되살릴 때 써요.">
        <input type="file" accept=".json,application/json" aria-label="백업 파일 불러오기" onChange={load} className="text-sm" />
      </Card>
      <Card title="새 학년 준비" desc="지금 자료를 내려받은 뒤 학생·입력·초안만 비워요.">
        <Button variant="ghost" onClick={clearAll}>자료 내려받고 비우기</Button>
      </Card>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </>
  );
}
