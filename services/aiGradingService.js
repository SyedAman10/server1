const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AI Grading Service
 * Handles AI-powered grading of student submissions
 */

/**
 * Extract grading criteria from assignment description and files
 */
async function extractGradingCriteria(assignment) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    let prompt = `You are an expert educator. Analyze this assignment and extract the grading criteria, rubric, and expectations.

Assignment Title: ${assignment.title}
Description: ${assignment.description || 'No description provided'}
Max Points: ${assignment.max_points || 100}
`;

    // If assignment has attachments (instructions file), mention it
    const attachments = assignment.attachments ? 
      (typeof assignment.attachments === 'string' ? JSON.parse(assignment.attachments) : assignment.attachments) : [];
    
    if (attachments.length > 0) {
      prompt += `\nThe assignment includes ${attachments.length} attachment(s) with instructions.\n`;
      attachments.forEach((att, i) => {
        prompt += `File ${i + 1}: ${att.originalName}\n`;
      });
    }

    prompt += `\nPlease extract and structure:
1. **Grading Criteria**: What are the main evaluation points?
2. **Rubric**: Break down how points should be allocated
3. **Key Requirements**: What must students include/demonstrate?
4. **Quality Indicators**: What makes a good vs. poor submission?

Provide the output in JSON format:
{
  "criteria": ["criterion 1", "criterion 2", ...],
  "rubric": {
    "criterion_name": {
      "points": X,
      "description": "...",
      "levels": {
        "excellent": "...",
        "good": "...",
        "fair": "...",
        "poor": "..."
      }
    }
  },
  "requirements": ["requirement 1", "requirement 2", ...],
  "totalPoints": ${assignment.max_points || 100}
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extractedCriteria = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        criteria: extractedCriteria,
        rawText: response
      };
    }
    
    return {
      success: false,
      error: 'Could not extract structured criteria',
      rawText: response
    };
    
  } catch (error) {
    console.error('Error extracting grading criteria:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Grade a student submission using AI
 */
async function gradeSubmission(submission, assignment, gradingSettings) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Get grading criteria
    const criteria = gradingSettings.rubric || {};
    const maxPoints = gradingSettings.max_points || assignment.max_points || 100;
    
    let prompt = `You are an expert educator grading a student assignment. Be fair, constructive, and thorough.

**ASSIGNMENT DETAILS:**
Title: ${assignment.title}
Description: ${assignment.description || 'No description'}
Max Points: ${maxPoints}

**GRADING CRITERIA:**
${JSON.stringify(criteria, null, 2)}

${gradingSettings.ai_instructions ? `\n**INSTRUCTOR'S GRADING INSTRUCTIONS:**\n${gradingSettings.ai_instructions}\n` : ''}

**STUDENT SUBMISSION:**
${submission.submission_text || 'No text provided'}
`;

    // If submission has attachments, mention them
    const submissionAttachments = submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : [];
    
    if (submissionAttachments.length > 0) {
      prompt += `\n**Student uploaded ${submissionAttachments.length} file(s):**\n`;
      submissionAttachments.forEach((att, i) => {
        prompt += `${i + 1}. ${att.originalName} (${(att.size / 1024).toFixed(2)} KB)\n`;
      });
    }

    prompt += `\n**YOUR TASK:**
Grade this submission based on the criteria provided. Provide:

1. **Overall Grade**: A numerical score out of ${maxPoints}
2. **Detailed Feedback**: Constructive comments on what was done well and what needs improvement
3. **Breakdown**: Score for each criterion
4. **Suggestions**: Specific recommendations for improvement

Output in JSON format:
{
  "grade": X,
  "maxPoints": ${maxPoints},
  "percentage": X,
  "feedback": "Detailed constructive feedback...",
  "breakdown": {
    "criterion_name": {
      "score": X,
      "maxScore": Y,
      "comment": "..."
    }
  },
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}

Be specific, encouraging, and helpful in your feedback.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const gradeData = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        grade: gradeData.grade,
        feedback: gradeData.feedback,
        analysis: gradeData,
        rawResponse: response
      };
    }
    
    return {
      success: false,
      error: 'Could not extract structured grade',
      rawResponse: response
    };
    
  } catch (error) {
    console.error('Error grading submission:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate grading rubric suggestions based on assignment
 */
async function generateRubricSuggestions(assignment) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `As an educational expert, suggest a grading rubric for this assignment:

Title: ${assignment.title}
Description: ${assignment.description || 'No description'}
Max Points: ${assignment.max_points || 100}

Create a detailed, fair rubric that breaks down the grading into specific criteria.
Each criterion should have point values and clear expectations.

Output in JSON format:
{
  "criteria": [
    {
      "name": "Criterion Name",
      "points": X,
      "description": "What this evaluates",
      "levels": {
        "excellent": "Description of excellent work (90-100%)",
        "good": "Description of good work (70-89%)",
        "satisfactory": "Description of satisfactory work (50-69%)",
        "needs_improvement": "Description of work needing improvement (<50%)"
      }
    }
  ],
  "totalPoints": ${assignment.max_points || 100}
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        success: true,
        rubric: JSON.parse(jsonMatch[0])
      };
    }
    
    return {
      success: false,
      error: 'Could not generate rubric'
    };
    
  } catch (error) {
    console.error('Error generating rubric:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  extractGradingCriteria,
  gradeSubmission,
  generateRubricSuggestions
};

