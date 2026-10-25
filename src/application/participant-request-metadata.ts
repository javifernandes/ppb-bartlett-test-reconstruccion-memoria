export const participantRequestMetadataResourceKey =
  "bartlett.participant-request-metadata";

export type ParticipantRequestMetadata = {
  countryCode: string | null;
};

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

export const participantRequestMetadataFromRequest = (
  request: Request,
): ParticipantRequestMetadata => ({
  countryCode: normalizeCountryCode(
    request.headers.get("x-vercel-ip-country") ??
      process.env.PARTICIPANT_COUNTRY_OVERRIDE,
  ),
});
