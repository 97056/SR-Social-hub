const faqs = [
  ["Who is it for?", "Marketing agencies managing several clients, and individual businesses managing their own brand. Each workspace is isolated."],
  ["What is a post target?", "One published delivery to one connected social account. Partial success is shown per account instead of as a single yes or no."],
  ["Can a draft publish itself while approval is pending?", "No. If the scheduled time passes while approval is still pending, the job stays blocked and asks for a new time."],
  ["Are all social networks included at these prices?", "No. A connector appears as available only after its official API access has passed an authorized test. X, in particular, has its own usage cost."],
  ["What happens when a subscription ends?", "New publishing jobs stop according to the plan status. Existing content is not deleted automatically."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">FAQ</h1>
      <div className="mt-6 space-y-3">
        {faqs.map(([question, answer]) => (
          <details key={question} className="rounded-brand bg-surface p-4">
            <summary className="cursor-pointer font-semibold">{question}</summary>
            <p className="mt-2 text-sm leading-6">{answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
