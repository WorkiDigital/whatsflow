import { createFileRoute } from "@tanstack/react-router";
import { FlowLogsView } from "@/components/flow-logs-view";
import { useTranslation as usePanelTranslation } from "@/i18n/provider";

export const Route = createFileRoute("/dashboard/$organizationSlug/logs")({
	component: LogsPage,
});

function LogsPage() {
	const panelT = usePanelTranslation();

	return (
		<FlowLogsView
			title={panelT("Execution Logs")}
			description="Execution history across your flows."
		/>
	);
}
