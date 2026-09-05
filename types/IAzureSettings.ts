// types/IAzureSettings.ts

export interface IAzureSettings {
  instanceUrl: string;
  azureCollection: string;
  pat: string;
  username?: string;
  defaultProject?: string;
  defaultRepository?: string;
  reportTitle?: string;
  ignoreTlsErrors: boolean,
};

export interface ObservationsClientProps {
  azureSettings: IAzureSettings | null;
}