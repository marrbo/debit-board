// components/ResultsList.tsx
"use client";

import type { SearchItem } from "@/lib/types";
import { groupBy, calculateTotalHits } from "@/lib/utils";
import {
  FileCode,
  FolderTree,
  GitBranch,
  ExternalLink,
  Target,
  Search,
} from "lucide-react";

interface ResultsListProps {
  items: SearchItem[];
  groupByMode: string;
  azureSettings?: any;
}

export default function ResultsList({
  items,
  groupByMode,
  azureSettings,
}: ResultsListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg p-12 text-center text-muted dark:text-muted shadow-sm hover:drop-shadow-lg transition-colors">
        <div className="flex justify-center mb-3">
          <Search className="w-12 h-12 text-muted" />
        </div>
        <p className="text-base font-semibold">
          Nenhum resultado encontrado com os filtros atuais.
        </p>
      </div>
    );
  }

  if (groupByMode === "flat") {
    return <FlatList items={items} azureSettings={azureSettings} />;
  }

  if (groupByMode === "gerencia-nucleo") {
    return <GerenciaNucleoList items={items} azureSettings={azureSettings} />;
  }

  if (groupByMode === "project") {
    return renderGrouped(items, "project", azureSettings);
  }

  if (groupByMode === "repo") {
    return renderGrouped(items, "repository", azureSettings);
  }

  return renderProjectRepo(items, azureSettings);
}

// ---------------- Helpers ----------------

function FileRow({
  item,
  showBadges = false,
  azureSettings,
}: {
  item: SearchItem;
  showBadges?: boolean;
  azureSettings: any;
}) {
  const {
    azureCollection: collection,
    project,
    repository,
    branch,
    fileName,
    path,
    hitCount,
  } = item;
  const instanceUrl = azureSettings?.instanceUrl || "";
  const azureCollection =
    azureSettings?.azureCollection || collection || "DefaultCollection";
  const azureUrl = `${instanceUrl}/tfs/${azureCollection}/${project}/_git/${repository}?path=${path}&_a=contents`;

  return (
    <div className="bg-surface dark:bg-surface hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] border border-default dark:border-strong/80 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 transition-colors group shadow-sm hover:drop-shadow-lg dark:shadow-none">
      <div className="flex items-start space-x-3 overflow-hidden">
        <FileCode className="text-brand w-5 h-5 mt-0.5 shrink-0" />
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={azureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-heading dark:text-heading text-sm hover:text-brand transition-colors inline-flex items-center gap-1"
              title="Abrir no Azure DevOps"
            >
              {fileName}
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            {branch && (
              <span className="text-[10px] bg-[#F2F2F7] dark:bg-page border border-default dark:border-strong text-muted dark:text-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {branch}
              </span>
            )}
          </div>
          <p
            className="text-xs font-mono text-muted truncate mt-0.5"
            title={path}
          >
            {path}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
        {showBadges && (
          <>
            {project && (
              <span className="text-[10px] bg-apple-green/10 text-success border border-[#34C759]/20 px-2 py-0.5 rounded-full">
                {project}
              </span>
            )}
            {repository && (
              <span className="text-[10px] bg-[#AF52DE]/10 text-[#AF52DE] border border-[#AF52DE]/20 px-2 py-0.5 rounded-full">
                {repository}
              </span>
            )}
          </>
        )}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-apple-orange/10 text-warning border border-[#FF9500]/20 text-xs font-semibold rounded-full">
          <Target className="w-3 h-3" />
          {hitCount || 0} hits
        </span>
      </div>
    </div>
  );
}

function FlatList({
  items,
  azureSettings,
}: {
  items: SearchItem[];
  azureSettings: any;
}) {
  return (
    <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg p-4 shadow-sm hover:drop-shadow-lg grid grid-cols-1 gap-2 transition-colors">
      {items.map((item, index) => (
        <FileRow
          key={index}
          item={item}
          showBadges={true}
          azureSettings={azureSettings}
        />
      ))}
    </div>
  );
}

function GerenciaNucleoList({
  items,
  azureSettings,
}: {
  items: SearchItem[];
  azureSettings: any;
}) {
  const gerenciaGroups = groupBy(items, "gerencia" as any);
  return (
    <div className="space-y-4">
      {Object.entries(gerenciaGroups)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([gerencia, gerenciaItems]) => {
          const nucleoGroups = groupBy(gerenciaItems, "nucleo" as any);
          return (
            <div
              key={gerencia}
              className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg transition-colors"
            >
              <div className="px-5 py-4 flex items-center justify-between bg-surface dark:bg-surface border-b border-default dark:border-strong">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-brand/10 text-brand rounded-lg">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-heading dark:text-heading">
                      Gerência: {gerencia}
                    </h3>
                    <p className="text-xs text-muted">
                      {gerenciaItems.length} arquivo(s)
                    </p>
                  </div>
                </div>
                <span className="bg-brand/10 text-brand border border-brand/20 text-xs font-semibold px-3 py-1 rounded-full">
                  {calculateTotalHits(gerenciaItems)} Hits
                </span>
              </div>
              {Object.entries(nucleoGroups)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([nucleo, nucleoItems]) => (
                  <div
                    key={nucleo}
                    className="border-t border-default dark:border-strong/60 bg-surface dark:bg-surface/50"
                  >
                    <div className="px-5 py-3 bg-[#F2F2F7] dark:bg-surface/80 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="text-[#AF52DE] w-4 h-4" />
                        <span className="font-semibold text-sm text-[#AF52DE]">
                          Núcleo: {nucleo}
                        </span>
                        <span className="text-xs text-muted">
                          ({nucleoItems.length} arquivo(s))
                        </span>
                      </div>
                      <span className="text-xs bg-[#AF52DE]/10 text-[#AF52DE] border border-[#AF52DE]/20 px-2.5 py-0.5 rounded-full font-medium">
                        {calculateTotalHits(nucleoItems)} hits
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 gap-2">
                      {nucleoItems.map((item, idx) => (
                        <FileRow
                          key={idx}
                          item={item}
                          azureSettings={azureSettings}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
    </div>
  );
}

function renderGrouped(
  items: SearchItem[],
  key: "project" | "repository",
  azureSettings: any,
) {
  const grouped = groupBy(items, key);
  return (
    <div className="space-y-4">
      {Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([groupKey, groupItems]) => {
          const totalHits = calculateTotalHits(groupItems);
          const Icon = key === "project" ? FolderTree : GitBranch;
          const color = key === "project" ? "[#34C759]" : "[#AF52DE]";
          return (
            <div
              key={groupKey}
              className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg transition-colors"
            >
              <div className="px-5 py-4 flex items-center justify-between bg-surface dark:bg-surface border-b border-default dark:border-strong">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 bg-${color}/10 text-${color} rounded-lg`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-heading dark:text-heading">
                      {groupKey}
                    </h3>
                    <p className="text-xs text-muted">
                      {groupItems.length} arquivo(s)
                    </p>
                  </div>
                </div>
                <span
                  className={`bg-${color}/10 text-${color} border border-${color}/20 text-xs font-semibold px-3 py-1 rounded-full`}
                >
                  {totalHits} Hits
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 gap-2">
                {groupItems.map((item, idx) => (
                  <FileRow
                    key={idx}
                    item={item}
                    azureSettings={azureSettings}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function renderProjectRepo(items: SearchItem[], azureSettings: any) {
  const grouped = groupBy(items, "project");
  return (
    <div className="space-y-4">
      {Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([projectName, projectItems]) => {
          const repoGroups = groupBy(projectItems, "repository");
          const totalHits = calculateTotalHits(projectItems);
          const totalRepos = Object.keys(repoGroups).length;
          const totalFiles = projectItems.length;
          return (
            <div
              key={projectName}
              className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg transition-colors"
            >
              <div className="px-5 py-4 flex items-center justify-between bg-surface dark:bg-surface">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-apple-green/10 text-success rounded-lg">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-heading dark:text-heading">
                      {projectName}
                    </h3>
                    <p className="text-xs text-muted">
                      {totalRepos} repositório(s) • {totalFiles} arquivo(s)
                    </p>
                  </div>
                </div>
                <span className="bg-apple-green/10 text-success border border-[#34C759]/20 text-xs font-semibold px-3 py-1 rounded-full">
                  {totalHits} Hits Totais
                </span>
              </div>
              {Object.entries(repoGroups)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([repoName, repoItems]) => {
                  const repoHits = calculateTotalHits(repoItems);
                  return (
                    <div
                      key={repoName}
                      className="border-t border-default dark:border-strong/60 bg-surface dark:bg-surface/50"
                    >
                      <div className="px-5 py-3 bg-[#F2F2F7] dark:bg-surface/80 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <GitBranch className="text-[#AF52DE] w-4 h-4" />
                          <span className="font-semibold text-sm text-[#AF52DE]">
                            {repoName}
                          </span>
                          <span className="text-xs text-muted">
                            ({repoItems.length} arquivo(s))
                          </span>
                        </div>
                        <span className="text-xs bg-[#AF52DE]/10 text-[#AF52DE] border border-[#AF52DE]/20 px-2.5 py-0.5 rounded-full font-medium">
                          {repoHits} hit(s)
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 gap-2">
                        {repoItems.map((item, idx) => (
                          <FileRow
                            key={idx}
                            item={item}
                            azureSettings={azureSettings}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
    </div>
  );
}
