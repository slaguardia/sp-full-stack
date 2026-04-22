import { ClassifyForm } from "@/components/classify-form";
import { PipelineCta } from "@/components/pipeline-cta";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 pt-6">
      <PipelineCta />
      <ClassifyForm />
    </div>
  );
}
