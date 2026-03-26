import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import type { Evaluation, Run } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ReportHeader } from '../components/ReportHeader.js';
import { ScoreBreakdown } from '../components/ScoreBreakdown.js';
import { CriticalChecklist } from '../components/CriticalChecklist.js';
import { AnswerComparison } from '../components/AnswerComparison.js';
import { ComplianceTable } from '../components/ComplianceTable.js';
import { UsagePanel } from '../components/UsagePanel.js';
import { StrengthsWeaknesses } from '../components/StrengthsWeaknesses.js';
import { MessageLog } from '../components/MessageLog.js';
import { useLiveProcess } from '../hooks/useLiveProcess.js';

// ---------------------------------------------------------------------------
// Report view (shown when evaluation is complete)
// ---------------------------------------------------------------------------

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant/5 overflow-hidden">
      <div className="px-4 py-3 bg-surface-container border-b border-outline-variant/10 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary/60" style={{ fontSize: '1.1rem' }}>{icon}</span>
        <h2 className="text-sm font-bold text-on-surface">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function extractStrengthsWeaknesses(evaluation: Evaluation): { strengths: string[]; weaknesses: string[]; recommendations: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  for (const [dim, score] of Object.entries(evaluation.synthesis.dimensionScores)) {
    if (score >= 8) strengths.push(`Strong performance on ${dim} (${score.toFixed(1)}/10)`);
    if (score < 4) weaknesses.push(`Low score on ${dim} (${score.toFixed(1)}/10)`);
  }
  for (const f of evaluation.criticalResults.filter((r) => !r.met)) {
    weaknesses.push(`Failed: ${f.requirement}`);
    recommendations.push(`Address critical requirement: ${f.requirement}`);
  }
  for (const v of evaluation.setupCompliance.instructionCompliance.violated) {
    weaknesses.push(`Violated instruction: ${v}`);
  }
  if (strengths.length === 0) strengths.push('Evaluation completed successfully');
  return { strengths, weaknesses, recommendations };
}

function FullReport({ evaluation, run }: { evaluation: Evaluation; run: Run | null }): React.JSX.Element {
  const { strengths, weaknesses, recommendations } = extractStrengthsWeaknesses(evaluation);
  const scenario = run?.scenarioSnapshot;

  return (
    <div className="space-y-6">
      {evaluation.synthesis && (
        <ReportHeader synthesis={evaluation.synthesis} answerComparison={evaluation.answerComparison} totalCostUsd={evaluation.totalCostUsd} numRounds={evaluation.rounds.length} />
      )}
      {evaluation.synthesis && (
        <SectionCard title="Score Breakdown" icon="analytics">
          <ScoreBreakdown dimensionScores={evaluation.synthesis.dimensionScores} dimensions={scenario?.scoringDimensions ?? []} />
        </SectionCard>
      )}
      <SectionCard title="Critical Requirements" icon="checklist">
        <CriticalChecklist results={evaluation.criticalResults} />
      </SectionCard>
      <SectionCard title="Answer Comparison" icon="compare_arrows">
        <AnswerComparison comparison={evaluation.answerComparison} expectedAnswer={scenario?.expectedAnswer ?? ''} actualAnswer={run?.resultText ?? ''} />
      </SectionCard>
      <SectionCard title="Instruction Compliance" icon="policy">
        <ComplianceTable compliance={evaluation.setupCompliance.instructionCompliance} />
      </SectionCard>
      <SectionCard title="Tool & Agent Usage" icon="precision_manufacturing">
        <UsagePanel compliance={evaluation.setupCompliance} />
      </SectionCard>
      <SectionCard title="Analysis" icon="insights">
        <StrengthsWeaknesses strengths={strengths} weaknesses={weaknesses} recommendations={recommendations} />
      </SectionCard>
      {evaluation.rounds.length > 0 && (
        <SectionCard title={`Evaluation Rounds (${evaluation.rounds.length})`} icon="sync">
          <div className="space-y-3">
            {evaluation.rounds.map((round) => (
              <div key={round.roundNumber} className="bg-surface-container rounded-md p-3 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-on-surface">Round {round.roundNumber}</span>
                  <span className={'text-[0.65rem] font-bold ' + (round.consensusReached ? 'text-green-400' : 'text-yellow-400')}>
                    {round.consensusReached ? 'Consensus' : 'No consensus'}
                  </span>
                </div>
                <div className="space-y-1">
                  {round.evaluations.map((ev, idx) => (
                    <div key={idx} className="text-xs text-on-surface-variant flex items-baseline gap-2">
                      <span className="font-mono text-on-surface-variant/60 w-20 flex-shrink-0">{ev.evaluatorRole}</span>
                      <span className="text-on-surface font-medium">{ev.dimension}</span>
                      <span className="font-mono ml-auto">{ev.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function ReportView(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseUrl, setSseUrl] = useState<string | null>(null);

  const { messages, progressSteps } = useLiveProcess({
    sseUrl,
    onComplete: () => {
      if (id) {
        api.evaluations.get(id).then((fresh) => setEvaluation(fresh)).catch(() => {});
      }
    },
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    api.evaluations.get(id)
      .then(async (evalData) => {
        if (cancelled) return;
        setEvaluation(evalData);
        const runData = await api.runs.get(evalData.runId);
        if (!cancelled) setRun(runData);

        if (evalData.status === 'pending' || evalData.status === 'running') {
          setSseUrl(`/api/evaluations/${id}/stream`);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load evaluation');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-on-surface-variant text-sm animate-pulse">Loading evaluation...</div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-error text-sm">{error ?? 'Evaluation not found'}</div>
      </div>
    );
  }

  const isLive = evaluation.status === 'pending' || evaluation.status === 'running';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-on-surface-variant text-xs font-mono">
        <button type="button" onClick={() => navigate('/history')} className="hover:text-on-surface transition-colors">History</button>
        <span>/</span>
        {run && (
          <>
            <button type="button" onClick={() => navigate(`/runs/${run.id}`)} className="hover:text-on-surface transition-colors">
              Run {run.id.slice(0, 8)}
            </button>
            <span>/</span>
          </>
        )}
        <span>Evaluation</span>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-1">Evaluation Report</h1>
          <p className="text-on-surface-variant text-sm">
            {run?.scenarioSnapshot ? `Scenario: ${run.scenarioSnapshot.name}` : `Run: ${evaluation.runId.slice(0, 8)}`}
          </p>
        </div>
        <StatusBadge status={evaluation.status} />
      </div>

      {isLive ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {evaluation.status === 'running' && (
              <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '1.2rem' }}>progress_activity</span>
            )}
            <h2 className="text-lg font-bold text-on-surface">
              {evaluation.status === 'running' ? 'Evaluation in progress...' : 'Waiting to start...'}
            </h2>
          </div>
          {progressSteps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {progressSteps.map((step, i) => (
                <span key={i} className="text-xs font-mono bg-surface-container px-2 py-1 rounded text-on-surface-variant border border-outline-variant/10">
                  {step}
                </span>
              ))}
            </div>
          )}
          <div className="bg-surface-container-low rounded-lg border border-outline-variant/5 overflow-hidden max-h-[60vh] overflow-y-auto">
            <MessageLog messages={messages} loading={messages.length === 0 && evaluation.status === 'running'} />
          </div>
        </div>
      ) : (
        <FullReport evaluation={evaluation} run={run} />
      )}
    </div>
  );
}
