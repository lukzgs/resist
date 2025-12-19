import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Player, Role, Phase } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not defined");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to construct context for the AI
const buildGameContext = (gameState: GameState, aiPlayer: Player) => {
  const visibleMissions = gameState.missions.slice(0, gameState.currentMissionIndex + 1);
  const isSpy = aiPlayer.role === Role.SPY;
  
  // Spies know other spies
  const knownSpies = isSpy 
    ? gameState.players.filter(p => p.role === Role.SPY).map(p => p.name).join(", ")
    : "None (You are Resistance)";

  return `
    You are playing "The Resistance". 
    Your Name: ${aiPlayer.name}
    Your Role: ${aiPlayer.role}
    ${isSpy ? `Your fellow Spies are: ${knownSpies}` : "You do not know who the spies are."}
    
    Current Phase: ${gameState.phase}
    Failed Votes Track: ${gameState.failedVoteCount}/5 (If 5, Spies win).
    Current Mission Round: ${gameState.currentMissionIndex + 1}
    
    Game History:
    ${gameState.logs.slice(-10).join("\n")}
  `;
};

/**
 * AI decides which players to put on the team.
 */
export const getAiTeamSelection = async (gameState: GameState, aiPlayer: Player, teamSize: number): Promise<string[]> => {
  const ai = getClient();
  const context = buildGameContext(gameState, aiPlayer);
  
  const prompt = `
    ${context}
    You are the Leader. You must select exactly ${teamSize} players for this mission.
    ${aiPlayer.role === Role.RESISTANCE ? "Choose players you trust." : "Choose a mix of spies and resistance to stay hidden, or just spies if you want to fail it."}
    
    Available Players:
    ${gameState.players.map(p => `- ${p.name} (ID: ${p.id})`).join("\n")}
    
    Return ONLY the list of IDs you select.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedPlayerIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            reasoning: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    // Fallback if AI hallucinates invalid IDs, but usually reliable with Schema
    const selected = json.selectedPlayerIds || [];
    // Ensure correct count by slicing or filling (safety fallback)
    if (selected.length !== teamSize) {
        // Fallback: Just pick self + random
        const others = gameState.players.filter(p => p.id !== aiPlayer.id).slice(0, teamSize - 1);
        return [aiPlayer.id, ...others.map(o => o.id)];
    }
    return selected;
  } catch (error) {
    console.error("AI Team Select Error", error);
    // Fallback random
    return gameState.players.slice(0, teamSize).map(p => p.id);
  }
};

/**
 * AI decides to Vote YES (Approve) or NO (Reject) on a proposed team.
 */
export const getAiTeamVote = async (gameState: GameState, aiPlayer: Player): Promise<{approve: boolean, reason: string}> => {
  const ai = getClient();
  const context = buildGameContext(gameState, aiPlayer);
  const teamNames = gameState.players.filter(p => gameState.proposedTeam.includes(p.id)).map(p => p.name).join(", ");

  const prompt = `
    ${context}
    The proposed team is: ${teamNames}.
    Leader is: ${gameState.players[gameState.leaderIndex].name}.
    
    Do you Vote YES (Approve team) or NO (Reject team)?
    If you are Resistance, vote NO if you suspect a spy is on the team.
    If you are Spy, vote YES if a spy is on the team, or NO to confuse the resistance.
    Also provide a short 1-sentence reason for the public chat.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            approve: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    return { approve: json.approve, reason: json.reason || "I have a hunch." };
  } catch (e) {
    return { approve: true, reason: "Let's see what happens." };
  }
};

/**
 * AI decides Mission Outcome (SUCCESS or FAIL).
 */
export const getAiMissionAction = async (gameState: GameState, aiPlayer: Player): Promise<boolean> => {
  // Resistance MUST vote Success.
  if (aiPlayer.role === Role.RESISTANCE) return true;

  const ai = getClient();
  const context = buildGameContext(gameState, aiPlayer);

  const prompt = `
    ${context}
    You are on the mission. You are a SPY.
    Do you want the mission to SUCCEED (stay hidden) or FAIL (gain a point for Spies)?
    
    Note: If you fail, people might suspect you. If you succeed, you gain trust but lose a scoring opportunity.
    Consider the current score.
    
    Return true for SUCCESS, false for FAIL.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN }
          }
        }
      }
    });
    const json = JSON.parse(response.text || '{}');
    return json.success;
  } catch (e) {
    return false; // Default spy behavior is sabotage
  }
};
