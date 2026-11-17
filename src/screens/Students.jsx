import { useState } from "react";
import { useAppState } from "../state.jsx";
import { addStudents, removeStudent } from "../lib/students.js";
import { Card, Button, inputCls, Notice } from "../components/ui.jsx";

export default function Students() {
  const [state, update] = useAppState();
  const [text, setText] = useState("");

  const add = () => {
    const names = text.split(/\r?\n|\t/);
    update((s) => addStudents(s, names));
    setText("");
  };

  const remove = (st) => {
    if (!window.confirm(`${st.number}번 ${st.name} 학생을 지울까요? 입력한 칩·메모·초안도 함께 지워져요.`)) return;
    update((s) => removeStudent(s, st.pseudoId));
  };

  return (
    <>
      <Card title="학생 추가" desc="엑셀이나 한글 명렬표에서 이름을 복사해 붙여넣으세요. 한 줄에 한 명씩이에요.">
        <textarea
          aria-label="학생 이름 붙여넣기"
          className={`${inputCls} h-28`}
          placeholder={"김하나\n이두리\n박세찬"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-stone-500">이름은 이 브라우저에만 저장돼요. AI에는 S01 같은 가명만 보내요.</p>
          <Button onClick={add} disabled={!text.trim()}>학생 추가</Button>
        </div>
      </Card>

      <Card title={`우리 반 학생 ${state.students.length}명`}>
        {state.students.length === 0 ? (
          <Notice>아직 학생이 없어요. 위에 이름을 붙여넣어 주세요.</Notice>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b">
                <th className="py-2 w-16">번호</th>
                <th className="w-20">가명</th>
                <th>이름</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {state.students.map((st) => (
                <tr key={st.pseudoId} className="border-b last:border-0">
                  <td className="py-2">{st.number}</td>
                  <td className="font-mono text-stone-500">{st.pseudoId}</td>
                  <td>{st.name}</td>
                  <td className="text-right">
                    <Button variant="danger" onClick={() => remove(st)}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
