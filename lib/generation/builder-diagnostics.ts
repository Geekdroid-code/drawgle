export interface BuilderProviderIdentity {
  provider: string;
  requestedModel: string;
  actualModel: string;
  fallbackUsed: boolean;
}

export function resolveBuilderProviderIdentity({
  provider,
  requestedModel,
  observedModels,
}: {
  provider: string;
  requestedModel: string;
  observedModels: Iterable<string>;
}): BuilderProviderIdentity {
  const models = Array.from(observedModels, (model) => model.trim()).filter(Boolean);
  const requested = requestedModel.trim() || models[0] || "unknown";
  const actual = models.at(-1) || requested;
  return {
    provider: provider.trim() || "unknown",
    requestedModel: requested,
    actualModel: actual,
    fallbackUsed: new Set(models).size > 1 || actual !== requested,
  };
}
