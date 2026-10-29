import { describe, expect, it, vi } from "vitest";
import { query } from "@ontahi/core/data-graph";

import {
  AnalysisRun,
  BartlettApplication,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
  ResultShare,
  ShareChannel,
} from "./graph";
import { analyzeRecallHeuristically } from "./recall-analysis";
import { parseRecallAnalysisOutput } from "./recall-analysis-model";
import { createBartlettSeed } from "./seed";

const participantClientMetadata = {
  browserLocale: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
  deviceType: "desktop" as const,
  browser: "Chrome",
  operatingSystem: "macOS",
  screenWidth: 1440,
  screenHeight: 900,
};

describe("Bartlett application bootstrap", () => {
  it("genera un volumen realista de participaciones para la demo local", () => {
    const seed = createBartlettSeed(true);
    const bilingualSessions = seed.ParticipantSession.filter(
      (session) => session.experiment === "experiment-bilingual-demo",
    );

    expect(bilingualSessions).toHaveLength(72);
    expect(
      bilingualSessions.filter((session) => session.status === "submitted"),
    ).toHaveLength(48);
    expect(
      new Set(bilingualSessions.map((session) => session.countryCode)),
    ).toEqual(new Set(["AR", "US", "BR", "MX"]));
  });

  it("rechaza operaciones administrativas sin un principal", async () => {
    const result = await Experiment.createDraft({
      id: "experiment-unauthorized",
      title: "No autorizado",
      story: "Este experimento no debe crearse.",
      createdAt: "2026-10-22T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: false,
      failure: { reason: "not_authenticated" },
    });
  });

  it("runs a Query and an Operation against in-memory storage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T13:05:00.000Z"));
    const asAdmin = <T>(run: () => T) =>
      BartlettApplication.app.runtime.withInvocationContext(
        {
          principal: { subject: "test-admin", kind: "user", issuer: "test" },
        },
        run,
      );
    const initial = await BartlettApplication.graph.read(query(Experiment), {
      scope: "bootstrap.initial-experiments",
    });

    expect(initial).toHaveLength(1);

    const created = await asAdmin(() =>
      Experiment.createDraft({
        id: "experiment-test",
        title: "Experimento de prueba",
        story: "Una historia de prueba suficientemente concreta.",
        createdAt: "2026-10-22T12:00:00.000Z",
      }),
    );

    expect(created.ok).toBe(true);

    const updated = await asAdmin(() =>
      Experiment.updateDraft({
        experiment: Experiment.refById("experiment-test"),
        title: "Experimento editado",
        participantTitle: "Una prueba de memoria",
        introduction: "Leé atentamente la siguiente historia.",
        consentText: "Acepto participar voluntariamente.",
        story: "La historia fue editada.",
        recallInstructions: "Escribí todo lo que recuerdes.",
        primaryLanguage: "es",
        alternateLanguage: null,
        alternateParticipantTitle: null,
        alternateIntroduction: null,
        alternateConsentText: null,
        alternateStory: null,
        alternateRecallInstructions: null,
        intervalSeconds: 30,
        distractorEnabled: true,
      }),
    );

    expect(updated).toMatchObject({
      ok: true,
      value: { title: "Experimento editado" },
    });

    const prepared = await asAdmin(() =>
      Experiment.prepareAnalysis({
        experiment: Experiment.refById("experiment-test"),
        preparedAt: "2026-10-22T12:59:00.000Z",
      }),
    );
    expect(prepared.ok).toBe(true);

    const published = await asAdmin(() =>
      Experiment.publish({
        experiment: Experiment.refById("experiment-test"),
        publishedAt: "2026-10-22T13:00:00.000Z",
        publicToken: "public-test-token",
        analysisRunId: "analysis-live-test",
      }),
    );

    expect(published).toMatchObject({
      ok: true,
      value: {
        status: "published",
        publicToken: "public-test-token",
      },
    });

    const rejectedUpdate = await asAdmin(() =>
      Experiment.updateDraft({
        experiment: Experiment.refById("experiment-test"),
        title: "No debe cambiar",
        participantTitle: "No debe cambiar",
        introduction: "No debe cambiar",
        consentText: "No debe cambiar",
        story: "No debe cambiar",
        recallInstructions: "No debe cambiar",
        primaryLanguage: "es",
        alternateLanguage: null,
        alternateParticipantTitle: null,
        alternateIntroduction: null,
        alternateConsentText: null,
        alternateStory: null,
        alternateRecallInstructions: null,
        intervalSeconds: 0,
        distractorEnabled: false,
      }),
    );

    expect(rejectedUpdate).toMatchObject({
      ok: false,
      failure: { reason: "experiment_not_editable" },
    });

    const channel = await asAdmin(() =>
      ShareChannel.create({
        id: "share-family",
        experiment: Experiment.refById("experiment-test"),
        name: "Familia",
        createdAt: "2026-10-22T13:04:00.000Z",
      }),
    );
    expect(channel).toMatchObject({
      ok: true,
      value: { name: "Familia", status: "active" },
    });

    const session = await ParticipantSession.start({
      id: "session-test",
      experiment: Experiment.refById("experiment-test"),
      shareChannel: ShareChannel.refById("share-family"),
      contentLanguage: "es",
      ...participantClientMetadata,
      startedAt: "2026-10-22T13:05:00.000Z",
    });
    expect(session).toMatchObject({
      ok: true,
      value: {
        status: "reading",
        shareChannel: { locator: { id: "share-family" } },
      },
    });

    const interval = await ParticipantSession.finishReading({
      session: ParticipantSession.refById("session-test"),
      experiment: Experiment.refById("experiment-test"),
    });
    expect(interval).toMatchObject({
      ok: true,
      value: { status: "interval" },
    });

    const tooEarly = await ParticipantSession.startRecall({
      session: ParticipantSession.refById("session-test"),
      experiment: Experiment.refById("experiment-test"),
    });
    expect(tooEarly).toMatchObject({
      ok: false,
      failure: { reason: "participant_interval_not_finished" },
    });

    vi.advanceTimersByTime(30_000);
    const recalling = await ParticipantSession.startRecall({
      session: ParticipantSession.refById("session-test"),
      experiment: Experiment.refById("experiment-test"),
    });
    expect(recalling).toMatchObject({
      ok: true,
      value: { status: "recalling" },
    });

    const submitted = await ParticipantSession.submitRecall({
      session: ParticipantSession.refById("session-test"),
      experiment: Experiment.refById("experiment-test"),
      recallText: "Recuerdo que la historia había sido editada.",
      submittedAt: "2026-10-22T13:10:00.000Z",
    });
    expect(submitted).toMatchObject({
      ok: true,
      value: {
        status: "submitted",
        recallText: "Recuerdo que la historia había sido editada.",
      },
    });

    await ParticipantSession.start({
      id: "session-pending",
      experiment: Experiment.refById("experiment-test"),
      shareChannel: null,
      contentLanguage: "es",
      ...participantClientMetadata,
      startedAt: "2026-10-22T13:11:00.000Z",
    });
    await ParticipantSession.finishReading({
      session: ParticipantSession.refById("session-pending"),
      experiment: Experiment.refById("experiment-test"),
    });
    vi.advanceTimersByTime(30_000);
    await ParticipantSession.startRecall({
      session: ParticipantSession.refById("session-pending"),
      experiment: Experiment.refById("experiment-test"),
    });

    const interimAnalysis = await asAdmin(() =>
      AnalysisRun.start({
        id: "analysis-too-early",
        experiment: Experiment.refById("experiment-test"),
        createdAt: "2026-10-22T13:11:31.000Z",
      }),
    );
    expect(interimAnalysis).toMatchObject({
      ok: true,
      value: { status: "running" },
    });

    const closed = await asAdmin(() =>
      Experiment.close({
        experiment: Experiment.refById("experiment-test"),
      }),
    );
    expect(closed).toMatchObject({
      ok: true,
      value: { status: "closed" },
    });

    const analysis = await asAdmin(() =>
      AnalysisRun.start({
        id: "analysis-test",
        experiment: Experiment.refById("experiment-test"),
        createdAt: "2026-10-22T13:12:30.000Z",
      }),
    );
    expect(analysis).toMatchObject({
      ok: true,
      value: {
        status: "running",
        analyzerVersion: "local:heuristic-v1",
      },
    });

    const recallAnalysis = await asAdmin(() =>
      RecallAnalysis.analyze({
        id: "recall-analysis-test",
        run: AnalysisRun.refById("analysis-test"),
        session: ParticipantSession.refById("session-test"),
        experiment: Experiment.refById("experiment-test"),
        createdAt: "2026-10-22T13:12:31.000Z",
      }),
    );
    expect(recallAnalysis).toMatchObject({
      ok: true,
      value: {
        status: "completed",
      },
    });
    const storedRecallAnalyses = await BartlettApplication.graph.read(
      query(RecallAnalysis),
      { scope: "bootstrap.recall-analyses" },
    );
    expect(storedRecallAnalyses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "recall-analysis-test",
          status: "completed",
          rubricVersion: "bartlett-heuristic-v1",
        }),
      ]),
    );

    const sharedResult = await asAdmin(() =>
      ResultShare.create({
        id: "shared-result-test",
        experiment: Experiment.refById("experiment-test"),
        session: ParticipantSession.refById("session-test"),
        createdAt: "2026-10-22T13:12:32.000Z",
      }),
    );
    expect(sharedResult).toMatchObject({
      ok: true,
      value: {
        id: "shared-result-test",
        contentLanguage: "es",
        story: "La historia fue editada.",
        recallText: "Recuerdo que la historia había sido editada.",
        readingSeconds: 0,
        distractorSeconds: 30,
        recallSeconds: 270,
        totalSeconds: 300,
        status: "active",
      },
    });

    const disabledShare = await asAdmin(() =>
      ResultShare.disable({
        share: ResultShare.refById("shared-result-test"),
      }),
    );
    expect(disabledShare).toMatchObject({
      ok: true,
      value: { status: "disabled" },
    });

    const finishedAnalysis = await asAdmin(() =>
      AnalysisRun.finish({
        run: AnalysisRun.refById("analysis-test"),
        hasErrors: false,
      }),
    );
    expect(finishedAnalysis).toMatchObject({
      ok: true,
      value: { status: "completed" },
    });

    const deletedSession = await asAdmin(() =>
      ParticipantSession.deletePermanently({
        session: ParticipantSession.refById("session-test"),
      }),
    );
    expect(deletedSession).toMatchObject({
      ok: true,
      value: { id: "session-test", status: "submitted" },
    });
    const sessionsAfterDeletion = await BartlettApplication.graph.read(
      query(ParticipantSession),
      { scope: "bootstrap.after-session-deletion" },
    );
    expect(sessionsAfterDeletion.map((session) => session.id)).not.toContain(
      "session-test",
    );

    const rejectedSubmission = await ParticipantSession.submitRecall({
      session: ParticipantSession.refById("session-pending"),
      experiment: Experiment.refById("experiment-test"),
      recallText: "Esta respuesta llegó después del cierre.",
      submittedAt: "2026-10-22T13:12:00.000Z",
    });
    expect(rejectedSubmission).toMatchObject({
      ok: false,
      failure: { reason: "experiment_not_accepting_responses" },
    });

    const rejectedSession = await ParticipantSession.start({
      id: "session-too-late",
      experiment: Experiment.refById("experiment-test"),
      shareChannel: null,
      contentLanguage: "es",
      ...participantClientMetadata,
      startedAt: "2026-10-22T13:13:00.000Z",
    });
    expect(rejectedSession).toMatchObject({
      ok: false,
      failure: { reason: "experiment_not_accepting_participants" },
    });

    const experiments = await BartlettApplication.graph.read(
      query(Experiment).orderBy((experiment) => experiment.title),
      { scope: "bootstrap.created-experiments" },
    );

    expect(experiments.map((experiment) => experiment.title)).toEqual([
      "Experimento editado",
      "Reconstrucción de una historia — prueba piloto",
    ]);

    const deleted = await asAdmin(() =>
      Experiment.deletePermanently({
        experiment: Experiment.refById("experiment-test"),
      }),
    );
    expect(deleted).toMatchObject({
      ok: true,
      value: { id: "experiment-test", status: "closed" },
    });

    const afterDeletion = await BartlettApplication.graph.read(
      query(Experiment),
      { scope: "bootstrap.after-deletion" },
    );
    expect(afterDeletion.map((experiment) => experiment.id)).not.toContain(
      "experiment-test",
    );
    vi.useRealTimers();
  });

  it("valida estrictamente la salida estructurada del analizador", () => {
    expect(
      parseRecallAnalysisOutput({
        retainedUnitsCount: 1,
        omittedUnitsCount: 1,
        intrusionCount: 0,
        unitAssessments: [
          {
            unitId: "es-u01",
            presence: "full",
            recallExcerpt: "Una canoa se acercó.",
            confidence: 0.9,
          },
        ],
        phenomena: [
          {
            kind: "omission",
            storyExcerpt: "Una canoa se acercó.",
            recallExcerpt: null,
            explanation: "No se recordó la llegada de la canoa.",
            confidence: 0.9,
          },
        ],
      }),
    ).toMatchObject({ retainedUnitsCount: 1, omittedUnitsCount: 1 });

    expect(() =>
      parseRecallAnalysisOutput({
        retainedUnitsCount: 1,
        omittedUnitsCount: 0,
        intrusionCount: 0,
        unitAssessments: [],
        phenomena: [{ kind: "inventado", confidence: 8 }],
      }),
    ).toThrow("fenómeno inválido");
  });

  it("detects omission and intrusion candidates with textual evidence", () => {
    const result = analyzeRecallHeuristically(
      "Dos jóvenes bajaron al río para cazar focas. Una canoa se acercó.",
      "Los jóvenes fueron a la montaña. Allí encontraron un automóvil rojo.",
    );

    expect(result.omittedUnitsCount).toBeGreaterThan(0);
    expect(result.intrusionCount).toBeGreaterThan(0);
    expect(result.phenomena).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "omission" }),
        expect.objectContaining({ kind: "intrusion" }),
      ]),
    );
  });
});
