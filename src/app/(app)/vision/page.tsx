import Link from "next/link";
import { FAMILY_VISION_QUESTIONS, VISION_QUESTIONS } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { getVision } from "@/lib/data";
import { VisionForm } from "./VisionForm";

export default async function VisionPage(props: PageProps<"/vision">) {
  const { tab } = await props.searchParams;
  const isFamily = tab === "family";
  const { family, ctx } = await getSession();
  const answers = await getVision(ctx, isFamily ? "family" : "personal");

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="h1">Видение жизни</h1>
        <p className="muted">Представьте, что прошло 5 лет. Не нужно знать все ответы — важно направление.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/vision" className={!isFamily ? "btn-primary" : "btn-ghost"}>🙋 Моё</Link>
        <Link href="/vision?tab=family" className={isFamily ? "btn-primary" : "btn-ghost"}>👨‍👩‍👧 Наша семья</Link>
      </div>
      <div className="card">
        {isFamily && !family ? (
          <p className="muted">Видение семьи заполняется вдвоём. <Link href="/family" className="text-accent underline">Создайте семью</Link> и пригласите партнёра.</p>
        ) : (
          <VisionForm key={isFamily ? "f" : "p"} scope={isFamily ? "family" : "personal"}
            questions={isFamily ? FAMILY_VISION_QUESTIONS : VISION_QUESTIONS} answers={answers} />
        )}
      </div>
      {isFamily && family && <p className="muted">Это видение общее: его видите и редактируете вы оба.</p>}
    </div>
  );
}
