"use client";

import { Tabs } from "@mantine/core";
import {
  IconAdjustments,
  IconChartBar,
  IconListDetails,
  IconLayoutDashboard,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/app/i18n";

export type ExperimentWorkspaceSection =
  | "summary"
  | "responses"
  | "analysis"
  | "configuration";

export const ExperimentWorkspaceTabs = ({
  experimentId,
  current,
  isDraft,
  analysisHref,
}: {
  experimentId: string;
  current: ExperimentWorkspaceSection;
  isDraft: boolean;
  analysisHref?: string;
}) => {
  const { t } = useI18n();
  const router = useRouter();

  const navigate = (section: string | null) => {
    if (section === "summary") router.push(`/experiments/${experimentId}`);
    if (section === "responses")
      router.push(`/experiments/${experimentId}?view=responses`);
    if (section === "analysis" && analysisHref) router.push(analysisHref);
    if (section === "configuration")
      router.push(`/experiments/${experimentId}?view=configuration`);
  };

  return (
    <Tabs value={current} variant="outline" onChange={navigate}>
      <Tabs.List style={{ overflowX: "auto", flexWrap: "nowrap" }}>
        <Tabs.Tab
          value="summary"
          leftSection={<IconLayoutDashboard size={16} />}
          disabled={isDraft}
        >
          {t("Resumen")}
        </Tabs.Tab>
        <Tabs.Tab
          value="responses"
          leftSection={<IconListDetails size={16} />}
          disabled={isDraft}
        >
          {t("Respuestas")}
        </Tabs.Tab>
        <Tabs.Tab
          value="analysis"
          leftSection={<IconChartBar size={16} />}
          disabled={isDraft || !analysisHref}
        >
          {t("Análisis")}
        </Tabs.Tab>
        <Tabs.Tab
          value="configuration"
          leftSection={<IconAdjustments size={16} />}
        >
          {t("Configuración")}
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
};
