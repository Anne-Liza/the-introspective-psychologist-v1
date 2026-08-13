import { useQuery } from "@tanstack/react-query";
import { DataState } from "../../../components/data/DataState";
import { PageHeader } from "../../../components/data/PageHeader";
import { JsonPreview } from "../../../components/data/JsonPreview";
import { apiClient } from "../../../lib/api-client";
async function fetchData() { const response = await apiClient.get("/app-settings"); return response.data; }
export function AppSettingsPage() { const { data, isLoading, isError } = useQuery({ queryKey: ["/app-settings"], queryFn: fetchData }); return <div className="space-y-6"><PageHeader title="App Settings" description="Review configurable app settings for the Developer Console and client-specific setup." /><DataState isLoading={isLoading} isError={isError} empty={!data} />{!isLoading && !isError && data && <div className="rounded-2xl border bg-white p-6 shadow-sm"><JsonPreview data={data} /></div>}</div>; }
