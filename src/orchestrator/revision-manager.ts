import { logger } from "../logger";

export interface RevisionResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
  totalDuration: number;
}

export interface RevisionFeedback {
  type: 'error' | 'clarification' | 'improvement';
  message: string;
  context?: Record<string, unknown>;
  confidence: number;
}

/**
 * Revision Manager - Handles intelligent revision loops for LLM-driven tasks
 * 
 * This class provides a minimal revision harness that allows tasks to be
 * revised based on execution feedback, with proper limits and error handling.
 */
export class RevisionManager {
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(maxAttempts: number = 3, timeoutMs: number = 30000) {
    this.maxAttempts = maxAttempts;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Execute a task with revision capability
   * 
   * @param task - The primary task function to execute
   * @param revise - The revision function that takes feedback and returns a new result
   * @param validate - Optional validation function to check if result is acceptable
   * @returns Promise<RevisionResult<T>> - The final result with metadata
   */
  async executeWithRevision<T>(
    task: () => Promise<T>,
    revise: (feedback: RevisionFeedback) => Promise<T>,
    validate?: (result: T) => { valid: boolean; feedback?: RevisionFeedback }
  ): Promise<RevisionResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    logger.info("orchestrator", "Starting revision loop", { 
      maxAttempts: this.maxAttempts,
      timeout: this.timeoutMs
    });

    while (attempts < this.maxAttempts) {
      attempts++;
      
      try {
        // Execute task (first attempt) or revision (subsequent attempts)
        const result = attempts === 1 ? await task() : await revise(this.generateFeedback(lastError, attempts));
        
        // Validate result if validator provided
        if (validate) {
          const validation = validate(result);
          if (!validation.valid) {
            lastError = validation.feedback?.message || "Validation failed";
            logger.warn("orchestrator", "Validation failed, attempting revision", { 
              attempt: attempts,
              feedback: lastError
            });
            continue;
          }
        }

        // Success!
        const duration = Date.now() - startTime;
        logger.info("orchestrator", "Task completed successfully", { 
          attempts,
          duration
        });

        return {
          success: true,
          result,
          attempts,
          totalDuration: duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        logger.warn("orchestrator", "Task execution failed", { 
          attempt: attempts,
          error: lastError
        });

        // If this is the last attempt, don't continue
        if (attempts >= this.maxAttempts) {
          break;
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    const errorMessage = lastError || "Task failed after maximum attempts";
    
    logger.error("orchestrator", "All revision attempts failed", { 
      attempts: this.maxAttempts,
      duration,
      finalError: errorMessage
    });

    return {
      success: false,
      error: errorMessage,
      attempts,
      totalDuration: duration
    };
  }

  /**
   * Execute with timeout protection
   */
  async executeWithTimeout<T>(
    task: () => Promise<T>,
    timeoutMs: number = this.timeoutMs
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      task()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Generate structured feedback for revision attempts
   */
  private generateFeedback(error: string | undefined, attempt: number): RevisionFeedback {
    if (!error) {
      return {
        type: 'improvement',
        message: `Attempt ${attempt} failed, please improve the approach`,
        confidence: 0.5
      };
    }

    // Analyze error type for better feedback
    if (error.includes('NameError') || error.includes('not defined')) {
      return {
        type: 'error',
        message: `Variable naming error: ${error}. Please check variable names and definitions.`,
        confidence: 0.8
      };
    }

    if (error.includes('TypeError') || error.includes('argument')) {
      return {
        type: 'error',
        message: `Type/argument error: ${error}. Please check parameter types and function signatures.`,
        confidence: 0.8
      };
    }

    if (error.includes('syntax')) {
      return {
        type: 'error',
        message: `Syntax error: ${error}. Please fix the Python syntax.`,
        confidence: 0.9
      };
    }

    // Generic error
    return {
      type: 'error',
      message: `Execution error: ${error}. Please fix the issue and try again.`,
      confidence: 0.6
    };
  }

  /**
   * Create a simple validator for common success criteria
   */
  static createValidator<T>(criteria: {
    hasOutput?: boolean;
    outputContains?: string[];
    outputMatches?: RegExp;
    customCheck?: (result: T) => boolean;
  }): (result: T) => { valid: boolean; feedback?: RevisionFeedback } {
    return (result: T) => {
      // Convert result to string for analysis
      const resultStr = String(result);
      
      // Check if result has output
      if (criteria.hasOutput && (!resultStr || resultStr.trim().length === 0)) {
        return {
          valid: false,
          feedback: {
            type: 'improvement',
            message: "Result is empty, please generate meaningful output",
            confidence: 0.7
          }
        };
      }

      // Check if output contains required strings
      if (criteria.outputContains) {
        const missingStrings = criteria.outputContains.filter(str => !resultStr.includes(str));
        if (missingStrings.length > 0) {
          return {
            valid: false,
            feedback: {
              type: 'improvement',
            message: `Output missing required content: ${missingStrings.join(', ')}`,
            confidence: 0.8
            }
          };
        }
      }

      // Check if output matches pattern
      if (criteria.outputMatches && !criteria.outputMatches.test(resultStr)) {
        return {
          valid: false,
          feedback: {
            type: 'improvement',
            message: "Output does not match expected format",
            confidence: 0.6
          }
        };
      }

      // Custom check
      if (criteria.customCheck && !criteria.customCheck(result)) {
        return {
          valid: false,
          feedback: {
            type: 'improvement',
            message: "Custom validation failed",
            confidence: 0.5
          }
        };
      }

      return { valid: true };
    };
  }

  /**
   * Get revision statistics
   */
  getStats(): { maxAttempts: number; timeoutMs: number } {
    return {
      maxAttempts: this.maxAttempts,
      timeoutMs: this.timeoutMs
    };
  }
}
