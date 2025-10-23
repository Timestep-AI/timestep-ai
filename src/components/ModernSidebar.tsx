import { X, Palette, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { AgentCard } from './AgentCard';
import { ThreadCard } from './ThreadCard';
import type { AgentRecord } from '@/types/agent';
import type { ThemeSettings } from './SidebarMenu';

interface ModernSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentRecord[];
  selectedAgent: AgentRecord | null;
  onAgentChange: (agentId: string) => void;
  threads: any[];
  currentThreadId: string | null;
  onThreadChange: (threadId: string) => void;
  themeSettings: ThemeSettings;
  onThemeChange: (settings: Partial<ThemeSettings>) => void;
  agentDetails?: AgentRecord | null;
  loadingAgentDetails?: boolean;
}

export const ModernSidebar = ({
  isOpen,
  onClose,
  agents,
  selectedAgent,
  onAgentChange,
  threads,
  currentThreadId,
  onThreadChange,
  themeSettings,
  onThemeChange,
  agentDetails,
  loadingAgentDetails,
}: ModernSidebarProps) => {
  const [expandedTheme, setExpandedTheme] = useState(false);
  const [expandedAgentDetails, setExpandedAgentDetails] = useState(true);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-l border-white/10 shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 backdrop-blur-sm bg-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-88px)] overflow-y-auto p-6 space-y-6">
          {/* Agents Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Agents</h3>
            <div className="grid gap-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isActive={selectedAgent?.id === agent.id}
                  onClick={() => onAgentChange(agent.id)}
                />
              ))}
            </div>

            {/* Agent Details Section */}
            {selectedAgent && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setExpandedAgentDetails(!expandedAgentDetails)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-white/70" />
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Agent Details</span>
                  </div>
                  {expandedAgentDetails ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
                </button>

                {expandedAgentDetails && agentDetails && (
                  <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
                    {loadingAgentDetails ? (
                      <div className="text-center text-white/50 text-sm py-4">Loading details...</div>
                    ) : (
                      <>
                        {agentDetails.model && (
                          <div className="space-y-1">
                            <div className="text-xs text-white/40 uppercase tracking-wide">Model</div>
                            <div className="text-sm text-white/90 font-mono bg-white/5 p-2 rounded">{agentDetails.model}</div>
                          </div>
                        )}

                        {agentDetails.instructions && (
                          <div className="space-y-1">
                            <div className="text-xs text-white/40 uppercase tracking-wide">Instructions</div>
                            <div className="text-sm text-white/70 bg-white/5 p-2 rounded max-h-32 overflow-y-auto">
                              {agentDetails.instructions}
                            </div>
                          </div>
                        )}

                        {agentDetails.tool_ids && agentDetails.tool_ids.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-white/40 uppercase tracking-wide">Tools ({agentDetails.tool_ids.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {agentDetails.tool_ids.map((toolId) => (
                                <span key={toolId} className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                                  {toolId.split('.').pop()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agentDetails.handoff_ids && agentDetails.handoff_ids.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-white/40 uppercase tracking-wide">Handoffs ({agentDetails.handoff_ids.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {agentDetails.handoff_ids.map((handoffId) => (
                                <span key={handoffId} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                                  {handoffId.slice(0, 8)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agentDetails.model_settings && Object.keys(agentDetails.model_settings).length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-white/40 uppercase tracking-wide">Model Settings</div>
                            <pre className="text-xs text-white/70 bg-white/5 p-2 rounded overflow-x-auto">
                              {JSON.stringify(agentDetails.model_settings, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1 pt-2 border-t border-white/10">
                          <div className="text-xs text-white/40 uppercase tracking-wide">Created</div>
                          <div className="text-xs text-white/50">
                            {new Date(agentDetails.created_at).toLocaleString()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Threads Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Chat Threads</h3>
            <div className="space-y-2">
              <ThreadCard isNewThread onClick={() => onThreadChange('')} isActive={!currentThreadId} />
              {threads.slice(0, 5).map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === currentThreadId}
                  onClick={() => onThreadChange(thread.id)}
                />
              ))}
            </div>
          </div>

          {/* Theme Settings */}
          <div className="space-y-3 pt-6 border-t border-white/10">
            <button
              onClick={() => setExpandedTheme(!expandedTheme)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <Palette size={18} className="text-white/70" />
                <span className="text-sm font-semibold text-white/70 uppercase tracking-wider">Theme</span>
              </div>
              {expandedTheme ? <ChevronUp size={18} className="text-white/50" /> : <ChevronDown size={18} className="text-white/50" />}
            </button>

            {expandedTheme && (
              <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
                {/* Color Scheme */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wide">Color Scheme</label>
                  <div className="flex gap-2">
                    {(['dark', 'light'] as const).map((scheme) => (
                      <button
                        key={scheme}
                        onClick={() => onThemeChange({ colorScheme: scheme })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          themeSettings.colorScheme === scheme
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wide">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeSettings.accentColor}
                      onChange={(e) => onThemeChange({ accentColor: e.target.value })}
                      className="w-full h-12 rounded-lg border-2 border-white/10 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-white/50 font-mono">{themeSettings.accentColor}</span>
                  </div>
                </div>

                {/* Radius */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wide">Border Radius</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['sharp', 'soft', 'round', 'pill'] as const).map((radius) => (
                      <button
                        key={radius}
                        onClick={() => onThemeChange({ radius })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          themeSettings.radius === radius
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {radius.charAt(0).toUpperCase() + radius.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Density */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wide">Density</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['compact', 'normal', 'spacious'] as const).map((density) => (
                      <button
                        key={density}
                        onClick={() => onThemeChange({ density })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          themeSettings.density === density
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {density.charAt(0).toUpperCase() + density.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
