export function PlanningEmptyCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 md:pl-[420px]" aria-label="Project planning canvas">
      <div className="max-w-sm text-center text-neutral-500">
        <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200">Your product starts here</p>
        <p className="mt-2 text-sm leading-6">Work out the product and choose the first flow with Drawgle in chat. Your screens will appear here when you approve the plan.</p>
      </div>
    </div>
  );
}
