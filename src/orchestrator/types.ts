export interface CodeArtifact {
  id: string;
  name: string;
  description: string;
  function: string;
  usage: string;
  dependencies: string[];
  test_cases?: Array<{
    input?: any;
    operation?: string;
    expected?: any;
  }>;
  created_by: string;
  reviewed_by?: string;
  status: 'pending' | 'approved' | 'needs_fixes' | 'rejected';
  artifactInterface?: ArtifactInterface; // Renamed to avoid 'interface' reserved word
}

export interface ArtifactInterface {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    has_default?: boolean;
    default?: any;
  }>;
  calling_pattern: string;
  has_varargs: boolean;
  has_kwargs: boolean;
  execution_template?: string;
  total_parameters: number;
  required_parameters: number;
  analysis_failed?: boolean;
}

export interface ReviewResult {
  artifact_id: string;
  artifact_name: string;
  approved: boolean;
  issues: string[];
  suggestions: string[];
  security_concerns: string[];
  test_results?: {
    pass: boolean;
    coverage: string;
  };
  feedback: string;
  recommendation: 'approved' | 'needs_fixes' | 'rejected';
}

export interface Subtask {
  id: string;
  description: string;
  requirements: string[];
  assignedSkill?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked' | 'failed';
  dependencies: string[];
  successCriteria: string;
  result?: any;
}

export interface ExecutionPlan {
  id: string;
  userRequest: string;
  subtasks: Subtask[];
  status: 'planning' | 'executing' | 'reviewing' | 'complete' | 'failed';
  createdAt: Date;
  currentFocus?: string;
}

export interface SharedContext {
  plan: ExecutionPlan;
  artifacts: CodeArtifact[];
  results: Map<string, any>;
  skillHistory: string[];
}
