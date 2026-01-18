# app/agents/llm_agent.py
import json
from openai import OpenAI
from app.core import config

class LLMAgent:
    def __init__(self):
        if not config.OPENAI_API_KEY: raise ValueError("OPENAI_API_KEY is not set.")
        self.client = OpenAI(api_key=config.OPENAI_API_KEY)

    def _get_json_response(self, system_prompt: str, user_prompt: str, max_retries: int = 3):
        # Use GPT-5 with minimal reasoning for fast, instruction-following JSON generation
        # GPT-5 is better at following instructions than GPT-4-turbo
        combined_prompt = f"{system_prompt}\n\n{user_prompt}\n\nIMPORTANT: Return ONLY a valid JSON object, no other text. Ensure all JSON is properly formatted with correct commas, brackets, and quotes."

        for attempt in range(max_retries):
            try:
                response = self.client.responses.create(
                    model="gpt-5",
                    input=combined_prompt,
                    reasoning={"effort": "minimal"},  # Fast, instruction-following mode
                    text={"verbosity": "low"}  # Concise output
                )

                # Try to parse the JSON
                output_text = response.output_text.strip()

                # Log the raw output for debugging
                print(f"📝 Raw LLM output (attempt {attempt + 1}):")
                print(output_text[:500] + "..." if len(output_text) > 500 else output_text)

                # Attempt to parse
                parsed_json = json.loads(output_text)
                print(f"✅ Successfully parsed JSON on attempt {attempt + 1}")
                return parsed_json

            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing error on attempt {attempt + 1}/{max_retries}: {str(e)}")
                print(f"❌ Error at line {e.lineno}, column {e.colno}: {e.msg}")

                # Show the problematic part of the JSON
                if hasattr(response, 'output_text'):
                    lines = response.output_text.split('\n')
                    if e.lineno <= len(lines):
                        print(f"❌ Problematic line: {lines[e.lineno - 1]}")

                # If this was the last attempt, raise the error
                if attempt == max_retries - 1:
                    print(f"❌ Failed to get valid JSON after {max_retries} attempts")
                    print(f"❌ Full output text:\n{response.output_text}")
                    raise

                # Otherwise, retry with a more explicit prompt
                print(f"🔄 Retrying with enhanced JSON formatting instructions...")
                combined_prompt = f"{system_prompt}\n\n{user_prompt}\n\nCRITICAL: Your previous response had a JSON syntax error at line {e.lineno}, column {e.colno}: {e.msg}\n\nReturn ONLY a valid JSON object with:\n- Proper commas between all key-value pairs\n- All strings properly quoted with double quotes\n- No trailing commas\n- Properly closed brackets and braces\n- No comments or extra text"

            except Exception as e:
                print(f"❌ Unexpected error on attempt {attempt + 1}/{max_retries}: {str(e)}")
                if attempt == max_retries - 1:
                    raise

    def describe_uploaded_character(self, image_url: str) -> str:
        """
        Use GPT-4 Vision to analyze an uploaded character image and return a detailed description.
        This description is used to create better prompts for character generation.
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Please describe what you see in this image in detail. Focus on the character's type (human/animal/creature), appearance, features, clothing, and pose."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ Error in describe_uploaded_character: {str(e)}")
            print(f"❌ Error type: {type(e).__name__}")
            raise

    # ===== MULTI-AGENT SYSTEM =====

    def create_story_summary(self, character_name: str, character_type: str, personality: str, themes: str, num_scenes: int) -> dict:
        """
        AGENT 0.5: Story Planner - Creates a complete story summary BEFORE breaking into scenes
        This ensures story cohesion and prevents random elements from appearing
        """

        # Determine story complexity based on scene count
        if num_scenes <= 6:
            complexity = "SHORT & SIMPLE"
            detail_level = "Keep it very simple - straightforward beginning, middle, end with minimal complications"
        elif num_scenes <= 10:
            complexity = "MEDIUM DETAIL"
            detail_level = "Include some challenges and development, but keep plot manageable"
        else:  # 12-15 scenes
            complexity = "MORE DETAILED"
            detail_level = "Can include more plot points and character development, but still clear and followable"

        system_prompt = f"""You are a children's story writer creating a complete story for a {num_scenes}-scene animated video.

**CHARACTER:**
- Name: {character_name}
- Type: {character_type}
- Personality: {personality}

**STORY THEME/IDEA:** {themes}

**STORY COMPLEXITY:** {complexity}
{detail_level}

**YOUR JOB:**
Write a complete, cohesive children's story from beginning to end. This story will later be broken into {num_scenes} scenes.

**CRITICAL RULES:**

1. **KEEP THE STORY SIMPLE**
   - This is a children's book - keep plot straightforward
   - Avoid overly complicated storylines or too many plot twists
   - Focus on clear, easy-to-follow narrative
   - Each scene will be condensed to 26-27 Korean characters, so simplicity is essential

2. **PLAN THE COMPLETE STORY FIRST**
   - Know exactly what happens from start to finish
   - Every element should have a reason to be there
   - Nothing should appear randomly or without setup

3. **STORY LENGTH GUIDELINES:**
   - **{num_scenes} scenes = {complexity}**
   - 3-6 scenes: Very simple story (one clear problem → solution)
   - 6-10 scenes: Medium story (problem → journey → solution)
   - 12-15 scenes: More detailed (setup → multiple challenges → resolution)
   - Even with more scenes, keep each event simple and clear

4. **LIMIT LOCATIONS**
   - **Avoid using the same location too many times** (visual consistency is hard!)
   - 3-6 scenes: 2-3 different locations max
   - 6-10 scenes: 3-4 different locations max
   - 12-15 scenes: 4-5 different locations max
   - Use scenery transitions to move between locations smoothly

5. **SIDE CHARACTERS - PROPER VISUAL INTRODUCTION**

   Side characters may or may not be needed depending on the story. Let the story naturally determine if side characters are necessary.

   **TECHNICAL LIMIT: Maximum 4 total characters in any single scene** (image generation model limitation)

   **CRITICAL RULE: Every side character MUST have a visual introduction/encounter scene BEFORE they interact or speak.**

   **The Problem We're Solving:**
   ❌ Characters appearing suddenly and speaking without the audience seeing them first
   ❌ "Scene 10: Tom runs. Scene 11: The bird tells Tom..." ← WHO IS THIS BIRD?!

   **The Solution - Two-Scene Pattern:**

   **Scene N - VISUAL ENCOUNTER (Bridge Scene):**
   - Character SEES, NOTICES, or ENCOUNTERS the side character
   - Establishes visual presence
   - May include minimal interaction, but focus is on noticing them
   - Examples:
     * "Tom runs past the window and sees a bird perched on the ledge"
     * "Ben hears rustling and sees a fox emerge from the bushes"
     * "Luna notices a dog sitting by the fence watching her"

   **Scene N+1 - INTERACTION:**
   - Now the side character can speak, help, or fully interact
   - Audience already knows they're there from previous scene
   - Examples:
     * "The bird chirps urgently and tells Tom to use the cushion"
     * "The fox offers to show Ben a shortcut through the forest"
     * "The dog barks and runs ahead, leading Luna to safety"

   **CORRECT Example:**
   ```
   Scene 10: Tom runs around the room and notices a bird on the window ledge watching him
   Scene 11: The bird chirps urgently and tells Tom to prop the vase with a cushion
   ← Bird was visually introduced first! ✅
   ```

   **WRONG Example:**
   ```
   Scene 10: Tom runs lightly around the room
   Scene 11: The bird urgently chirps and tells Tom to use a cushion
   ← No visual introduction! Who is this bird?! ❌
   ```

   **This Applies to ALL Side Characters:**
   - Dogs, cats, birds, people on the street, wise owls, helpful travelers - everyone
   - First scene: Visual presence established (they see/notice the character)
   - Next scene(s): Interaction, dialogue, helping
   - Creates smooth, natural flow instead of jarring "who's that?" moments

**Story-Based Approach:**
   - A journey through a forest → may naturally encounter animals, travelers
   - A story about family → may include mother, father as a package
   - A solo adventure → may not need any side characters at all
   - Let the STORY determine who appears, not a formula

6. **STORY STRUCTURE:**
   - **Beginning**: Introduce character and situation (1-2 scenes worth)
   - **Middle**: Challenge/journey (most scenes)
   - **End**: Resolution and lesson (1-2 scenes worth)

7. **COHESION - CRITICAL:**
   - Everything connects logically with proper setup
   - **NEVER introduce elements suddenly without preparation:**
     * New character appears → needs setup scene showing hints first
     * New location appears → needs transition or mention beforehand
     * New object appears → needs context or foreshadowing
   - Every scene flows naturally from the previous one
   - Clear cause and effect relationships
   - **Think: "Will the audience be confused by this sudden element?"**

**OUTPUT FORMAT:**

{{
  "story_summary": "A complete 3-5 sentence summary of the entire story from beginning to end. Include: who the character is, what they want/need, what challenges they face, how they overcome it, and what they learn.",

  "key_story_elements": {{
    "main_goal": "What the character wants or needs",
    "main_challenge": "The primary obstacle",
    "resolution": "How it's resolved",
    "lesson": "What the character learns"
  }},

  "locations_to_use": [
    "Location 1 name and brief description",
    "Location 2 name and brief description"
  ],

  "side_characters": [
    {{
      "name_or_type": "Either a name (if natural) or type like 'Fox', 'Bird', 'Dog'",
      "role": "How they help the story",
      "appears_when": "Brief note on when they appear (beginning/middle/end)"
    }}
  ],

  "story_flow": "A paragraph describing the complete story flow - what happens in order from start to finish"
}}

**REMEMBER:**
- This is a PLANNING stage - you're creating a roadmap for a cohesive story
- Every element you include will need to fit into {num_scenes} scenes
- **Side characters depend on the story** - some stories need them, some don't
- **Technical limit:** Maximum 4 total characters in any single scene
- **CRITICAL: Every side character needs a visual introduction scene BEFORE they interact**
  * Scene X: Character notices/sees the side character (bridge/encounter)
  * Scene X+1: Side character can now speak/help/interact
- **Nothing should appear suddenly without visual setup**
- Plan the encounter/bridge scenes into your story flow
- Some characters come as a package (e.g., mother + father together)
"""

        user_prompt = f"Create a complete story plan for a {num_scenes}-scene children's story about {character_name} (a {character_type}) with the theme: {themes}"

        return self._get_json_response(system_prompt, user_prompt)

    def create_story_blueprint(self, character_name: str, character_type: str, character_prompt: str, personality: str, themes: str, num_scenes: int, story_summary: dict = None, language: str = "English") -> dict:
        """
        AGENT 1: Story Director - Creates detailed scene-by-scene story breakdown
        This is the MOST IMPORTANT agent - it creates the foundation for all others
        """
        character_visual_context = f"\n- Visual Details: {character_prompt}" if character_prompt else ""

        # Include story summary if provided (from Agent 0.5)
        story_context = ""
        if story_summary:
            import json
            story_context = f"""
**COMPLETE STORY PLAN (from Story Planner):**

{json.dumps(story_summary, indent=2, ensure_ascii=False)}

**YOUR JOB:** Break this planned story into exactly {num_scenes} scenes. Follow the story plan precisely - don't add random elements or characters not in the plan.
"""
        else:
            story_context = "**YOUR JOB:** Create an original story and break it into scenes."

        system_prompt = f"""You are creating a {num_scenes}-scene story blueprint for a children's animated video.

**CHARACTER:**
- Name: {character_name}
- Type: {character_type}{character_visual_context}
- Personality: {personality}

**STORY THEME:** {themes}

{story_context}

═══════════════════════════════════════════════════════════════
CRITICAL #1: UNDERSTANDING "STORY THEME"
═══════════════════════════════════════════════════════════════

**IF you see "User's story idea:" - That's the EXACT plot they want. Build your ENTIRE story around it.**
**IF you only see "Generic theme:" - Create an original story using those themes.**

Example: "User's story idea: chef learning grandmother's recipe | Generic theme: family"
→ Story MUST be about: chef + grandmother + learning recipe (NOT just a generic family story)

═══════════════════════════════════════════════════════════════
CRITICAL #2: SCENE LENGTH (15-20 WORDS)
═══════════════════════════════════════════════════════════════

**WHY THIS MATTERS:**
Your scene descriptions will be converted to 26-27 Korean characters for narration.
If your scenes are too long/complex, the narration will be vague or incomplete.

**MANDATORY REQUIREMENTS:**
- Every "what_happens" must be 15-18 words
- Count words for EVERY scene you write
- ONE main action per scene - keep it simple
- **Use SIMPLE, KID-FRIENDLY vocabulary** (this is a children's book!)
- **Use COMMON, EASY words** that translate easily to Korean

**VOCABULARY GUIDELINES:**
✅ Use simple verbs children understand
✅ Use common, everyday words
✅ Keep descriptions straightforward and clear
✅ Avoid literary or poetic language

❌ Avoid sophisticated vocabulary
❌ Avoid complex descriptive phrases
❌ Avoid multiple adverbs and adjectives in one sentence
❌ Avoid overly detailed actions

**WHAT TO INCLUDE:**
✅ WHO does WHAT (always)
✅ WHERE (when location changes)
✅ Main action or event
✅ Enough detail for story flow and connection between scenes

**WHAT TO REMOVE:**
❌ Multiple complex actions in one scene
❌ Overly detailed descriptions
❌ Poetic or flowery language
❌ Unnecessary adverbs that add complexity

**EXAMPLES:**

❌ TOO COMPLEX: Uses multiple fancy adverbs and sophisticated verbs that make translation difficult
→ Problem: Won't fit naturally in Korean narration

✅ SIMPLE: Uses basic verbs and clear descriptions
→ Easy to translate and fits Korean character limits

❌ TOO POETIC: Uses flowery, literary descriptions with many adjectives
→ Problem: Overly descriptive for children's story

✅ SIMPLE: Uses straightforward descriptions
→ Clear and age-appropriate

═══════════════════════════════════════════════════════════════
CRITICAL #3: STORY STRUCTURE
═══════════════════════════════════════════════════════════════

**SCENE 1 FORMAT (MANDATORY):**
"There was a [type] named {character_name} who [trait/habit] in/at [location] and [goal]"

Must include:
- Character type (rabbit, chef, boy, etc.)
- Character name ({character_name})
- Where they live/work
- What they want (their goal)

Example: "There was a kind boy named Ben who lived in Pine Valley and dreamed of finding Whispering Falls"

**STORY ARC (3 PARTS):**

**BEGINNING (Scenes 1-2, ~20% of story):**
- Scene 1: Introduce character + location + CONCRETE goal
- Scene 2: Character takes first action toward goal

Examples:
- Scene 1: "There was a kind boy named Ben who lived in Pine Valley and dreamed of finding Whispering Falls" (19 words)
- Scene 2: "Ben packs his bag at dawn and sets off on the forest trail toward the falls" (17 words)

**MIDDLE (Most scenes, ~60% of story):**
Create 2-4 challenges/obstacles based on {num_scenes}:
- For 6 scenes: 2-3 challenges in scenes 3-5
- For 9 scenes: 3-4 challenges in scenes 3-7
- For 12 scenes: 4-5 challenges in scenes 3-10

Each challenge must be:
✅ SPECIFIC and concrete (not vague)
✅ Related to achieving the goal
✅ An obstacle that tests the character

Challenge examples:
- ✅ "Ben reaches a wide river with no bridge and must find a way across" (15 words)
- ✅ "Ben encounters heavy fog and loses sight of the mountain path ahead" (13 words)
- ❌ "Ben faces difficulties" (too vague - what difficulties?)

**END (Final 1-2 scenes, ~20% of story):**
- Second-to-last scene: Character overcomes final obstacle / achieves goal
- Final scene: Character reflects and learns lesson

Ending examples:
- "Ben and Mira reach Whispering Falls and see the beautiful cascade together" (12 words)
- "Ben realizes having a friend made the dangerous journey safer and more enjoyable" (13 words)

═══════════════════════════════════════════════════════════════
CRITICAL #4: SIDE CHARACTERS (3-STEP INTRODUCTION)
═══════════════════════════════════════════════════════════════

**SIDE CHARACTERS - Natural Integration:**

**IMPORTANT: If you received a story plan from Story Planner, use the side characters listed in that plan and follow the planned introduction pattern.**

Side characters may or may not be needed - let the story determine this naturally.

**TECHNICAL LIMIT: Maximum 4 total characters in any single scene** (including main character)

**CRITICAL RULE: Every side character needs TWO scenes minimum:**

**Scene 1 - VISUAL INTRODUCTION/ENCOUNTER (Bridge Scene):**
- Character SEES, NOTICES, or ENCOUNTERS the side character
- Establishes their visual presence
- Examples:
  * "Tom notices a bird perched on the window ledge"
  * "Ben sees a fox emerge from the bushes"
  * "Luna spots a dog sitting by the fence"

**Scene 2+ - INTERACTION:**
- Now they can speak, help, or interact
- Audience knows who they are from previous scene
- Examples:
  * "The bird chirps and tells Tom to use the cushion"
  * "The fox offers to show Ben the shortcut"

**❌ WRONG:** Side character suddenly speaks with no prior visual introduction
**✅ CORRECT:** Side character is seen first, then interacts in next scene(s)

**Naming Guidelines:**
- **Use descriptive terms when names aren't needed**: "a fox", "an owl", "a dog", "a bird"
- **Only give names if it makes narrative sense**:
  * Character has significant role in multiple scenes
  * Characters naturally exchange names in context
  * It feels more natural to use a name than keep repeating "the fox"
- **Don't force formulaic introductions** like "The bird introduced herself as..."

**Examples of Natural Handling:**

✅ **Without name (simple encounter):**
"Ben walks down the path and sees a dog in the bushes"
→ Later: "The dog barks and runs ahead"
→ characters_in_scene: ["Dog"] (use generic "Dog" as identifier)

✅ **With name (if natural):**
"An old owl appears and calls itself Oliver"
→ Later: "Oliver gives Ben advice about the journey"
→ characters_in_scene: ["Oliver"]

✅ **Descriptive only (brief role):**
"A bird chirps urgently from the window"
→ characters_in_scene: ["Bird"]

**CRITICAL - WHEN TO INCLUDE IN characters_in_scene:**

The rule is simple: **Include ALL characters PHYSICALLY PRESENT in the scene - both main character AND side characters.**

✅ Include {character_name} (main character) if present
✅ Include side characters from their FIRST appearance (even if no name mentioned yet)
✅ Use actual character names in the array
✅ Include in EVERY scene where they appear
⚠️ **MAXIMUM 4 characters total in any scene** (technical limitation)

**Note on "package" characters:**
- Some characters naturally appear together (e.g., "Mother" and "Father")
- Count each as a separate character in the array
- Still must respect 4-character maximum
- Example: ["{character_name}", "Mother", "Father"] = 3 characters ✅

**Examples:**

Scene with only main character:
→ characters_in_scene: ["{character_name}"]

Scene with main character + side character (no name):
"Ben walks through the forest and encounters a fox"
→ characters_in_scene: ["{character_name}", "Fox"]

Scene with main character + named side character:
"The owl introduces itself as Oliver and offers wisdom"
→ characters_in_scene: ["{character_name}", "Oliver"]

Scene with ONLY side character (rare but allowed):
"A wise owl watches over the forest alone"
→ characters_in_scene: ["Owl"]  ← Main character not present!

**Think of it this way:**
- "what_happens" = what the STORY says (may use "the fox", "a bird", or names like "Oliver")
- "characters_in_scene" = WHO is actually THERE (use "Fox", "Bird", "Oliver" as identifiers)

**Side Character Requirements:**
- Must appear in 2-3+ scenes (not just one!)
- Must actually HELP the main character
- Must have a PURPOSE in the story
- Must be included in characters_in_scene array for EVERY scene they appear in

**CRITICAL - HOW TO DESCRIBE SIDE CHARACTERS:**

❌ NEVER use generic "human" - be SPECIFIC about what type of person/animal they are!

**For human characters, specify:**
- Age/role: "young girl", "elderly man", "teenage boy", "wise woman", "kind shopkeeper"
- NOT just: "a human", "a person", "someone"

**For animal characters, specify:**
- Animal type: "clever fox", "wise owl", "playful rabbit", "gentle deer"
- NOT just: "an animal", "a creature"

**Examples:**
✅ GOOD: "Ben meets a young girl wearing a red scarf on the trail"
✅ GOOD: "A wise old owl perches on a branch and calls out to Luna"
✅ GOOD: "An elderly shopkeeper shows Milo an ancient map"

❌ BAD: "Ben meets a human on the trail" (too generic!)
❌ BAD: "An animal appears in the tree" (what kind of animal?)
❌ BAD: "Someone shows Milo a map" (who? what type of person?)

═══════════════════════════════════════════════════════════════
CRITICAL #5: SCENE TYPES
═══════════════════════════════════════════════════════════════

**ONLY TWO VALID VALUES:**

1. **"character"** - One or more characters appear in the scene
   → Can be: main character only, side character(s) only, or main + side characters together
   → Use this for MOST scenes

2. **"scenery"** - Wide environment shot, NO characters visible
   → Used for establishing locations, transitions, atmosphere
   → MINIMUM scenery scenes required:
     * 6 scenes total → at least 1 scenery scene
     * 9 scenes total → at least 1 scenery scene
     * 12 scenes total → at least 2 scenery scenes
     * 15 scenes total → at least 3 scenery scenes

**FORBIDDEN VALUES:**
❌ "main_character", "setup", "challenge", "climax", "resolution", "introduction", "conclusion"
→ These describe story structure, NOT scene types! Use "character" instead of "main_character"

═══════════════════════════════════════════════════════════════
EXAMPLE STORY (6 SCENES)
═══════════════════════════════════════════════════════════════

Character: Ben (kind boy)
Theme: User's story idea - boy searching for legendary Whispering Falls
Num scenes: 6

**Scene 1 (20 words):** "There was a kind boy named Ben who lived in Pine Valley and dreamed of finding the legendary Whispering Falls"
→ Has: character intro, location, concrete goal
→ Scene type: "character"
→ characters_in_scene: ["Ben"]

**Scene 2 (17 words):** "Ben packs his bag at dawn and begins hiking up the forest trail toward the falls"
→ Has: action starts, connection to Scene 1
→ Scene type: "character"
→ characters_in_scene: ["Ben"]

**Scene 3 (18 words):** "Ben meets a cloaked traveler on the misty forest path who seems to know the area well"
→ Has: first challenge/helper appears (NO NAME yet - step 1)
→ Scene type: "character"
→ characters_in_scene: ["Ben", "Mira"]  ← CRITICAL: Include BOTH even though Mira's name not used yet!

**Scene 4 (16 words):** "The traveler introduces himself as Mira and shows Ben a shortcut through the rocky terrain"
→ Has: name revealed (step 2), helper offers aid
→ Scene type: "character"
→ characters_in_scene: ["Ben", "Mira"]

**Scene 5 (17 words):** "Ben and Mira reach the waterfall together and Ben sees the beautiful cascade for the first time"
→ Has: goal achieved, teamwork
→ Scene type: "character"
→ characters_in_scene: ["Ben", "Mira"]

**Scene 6 (18 words):** "Ben thanks Mira and realizes that having a friend made the journey safer and more enjoyable than alone"
→ Has: lesson learned (friendship/companionship)
→ Scene type: "character"
→ characters_in_scene: ["Ben", "Mira"]

**Why this works:**
✅ All scenes 16-20 words
✅ Scene 1 follows mandatory format
✅ Clear goal in Scene 1 (find Whispering Falls)
✅ Side character follows 3-step rule (describe → name → use)
✅ **Side character included in array from Scene 3 onwards** (even when name not used!)
✅ Natural flow - each scene leads to next
✅ Satisfying ending with lesson learned

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

{{
  "story_summary": "One sentence summary",
  "side_characters": [
    {{"name": "Character name", "type": "type", "description": "visual details"}}
  ],
  "scene_blueprints": [
    {{
      "scene_number": 1,
      "scene_type": "character",
      "what_happens": "15-20 word description",
      "characters_in_scene": []
    }}
  ]
}}

═══════════════════════════════════════════════════════════════
CHECKLIST BEFORE SUBMITTING
═══════════════════════════════════════════════════════════════

☐ Scene 1: Starts with "There was a [type] named {character_name}..."?
☐ Scene 1: Includes location AND concrete goal?
☐ Every scene: 15-20 words? (COUNT THEM!)
☐ User's story idea: If provided, did I build ENTIRE story around it?
☐ Side characters: Follow 3-step rule? Appear in 2-3+ scenes?
☐ **Side characters: Included in characters_in_scene array for EVERY scene they appear (even Step 1)?**
☐ **Side characters: Described specifically (NOT "human" or "animal" - use "young girl", "wise owl", etc.)?**
☐ Scene types: Only "character" or "scenery"?
☐ **Scenery scenes: Have minimum required (6→1, 9→1, 12→2, 15→3)?**
☐ Story flow: Does each scene lead naturally to the next?
☐ Ending: Goal resolved + lesson learned?

**NOW:** Create your {num_scenes}-scene story following ALL requirements above.
"""

        user_prompt = f"""Create a {num_scenes}-scene story for {character_name} the {character_type}.

**CHARACTER INFO:**
- Name: {character_name}
- Type: {character_type}
- Personality: {personality}

**STORY DIRECTION:** {themes}

**LANGUAGE:** {language}

**YOUR MISSION:**
Follow the detailed instructions in the system prompt EXACTLY.

**CRITICAL REMINDERS:**
1. If "User's story idea" appears in Story Direction → that IS the plot!
2. Scene 1 MUST start: "There was a [type] named {character_name} who..."
3. Every scene: 15-18 words (COUNT THEM!)
4. **USE SIMPLE, KID-FRIENDLY WORDS** - This is a children's book!
5. Avoid sophisticated or literary vocabulary
6. Keep scenes simple - ONE action, not multiple complicated things happening
7. Side character visual introduction: Must have bridge scene BEFORE they interact
8. Natural flow: NO gaps between scenes
9. Scene type: ONLY "character" or "scenery" (use these exact values!)
10. **Scenery scenes: Minimum required - 6 scenes→1 scenery, 9→1, 12→2, 15→3**
11. Validate with checklist before submitting!

**REMEMBER:** Your scenes will be converted to 26-27 character Korean narration. Simple English makes translation easier!

Create exactly {num_scenes} scenes following ALL requirements.
"""
        return self._get_json_response(system_prompt, user_prompt)

    def write_scene_narrations(self, blueprint: dict, character_name: str, character_type: str, character_prompt: str, personality: str, language: str = "Korean") -> dict:
        """
        AGENT 2: Script Writer - Converts story scenes into TTS-ready narration
        Takes the "what_happens" from Agent 1 and turns it into spoken storytelling

        THIS IS A CRITICAL AGENT - The narration is the ONLY way listeners understand the story!
        """
        character_visual_context = f"\n- Visual Details: {character_prompt}" if character_prompt else ""

        system_prompt = f"""You are creating Korean narration for a children's story video.

**CHARACTER:**
- Name: {character_name}
- Type: {character_type}{character_visual_context}
- Personality: {personality}

**YOUR JOB:**
Turn each scene description into clear Korean narration that tells listeners EXACTLY what happens.

**CRITICAL RULES:**

**1. TELL WHAT ACTUALLY HAPPENS - BE CLEAR AND SPECIFIC**
   - Extract the FACTS from each scene description
   - WHO does WHAT - be concrete and specific
   - Don't be poetic or vague - be INFORMATIVE
   - Listeners can ONLY understand the story through your words

**2. LENGTH REQUIREMENT**
   - Target: 26 Korean characters (including spaces)
   - Acceptable range: 23-28 characters
   - **HARD LIMIT: NEVER exceed 28 characters**
   - Count characters for EVERY line you write
   - If over 28 characters, you MUST shorten it

**3. CHARACTER NAMES IN KOREAN**
   - Convert ALL names to Korean: "Luna" → "루나", "Ben" → "벤", "Mira" → "미라"
   - NEVER use English names in Korean narration

**4. PUNCTUATION - END WITH PERIOD (.)**
   - **EVERY narration must end with a period (.)**
   - This is CRITICAL for TTS generation quality
   - The period helps TTS understand sentence boundaries
   - Example: "상냥한 소년 벤이 소나무골에서 폭포를 꿈꿨어요." (26 chars) ← Notice the period!

**5. PROPER KOREAN GRAMMAR**
   - Use standard Korean grammar appropriate for children's storybooks
   - Do NOT use colloquial contractions or informal speech patterns
   - Use complete grammatical particles and proper sentence endings
   - Maintain educational quality with correct grammar throughout

**6. CREATE ONE CONNECTED STORY - NOT ISOLATED SENTENCES**

   **CRITICAL:** When read line by line (Scene 1 → 2 → 3...), your narrations must sound like ONE complete story.

   Each narration should:
   - Advance the story (what happens next)
   - Connect to what came before (reference previous events/elements)
   - Flow naturally into the next scene

   **How to connect scenes:**

   A. **Reference introduced elements:**
      - Scene 1: "벤은 속삭이는 폭포 이야기를 들었어요" (heard about Whispering Falls)
      - Scene 2: "벤은 그 폭포를 찾아 숲으로 출발했어요" (set off to find THE falls)
      → Use "그 폭포" (THE falls) not just "폭포" (falls)

   B. **Show location transitions (don't jump):**
      ❌ BAD (no transition):
      - Scene 2: "벤은 아침 일찍 일어나서 숲에 서 있었어요" (26 chars)
      - Scene 3: "벤은 강가에 도착해서 물소리를 듣고 있어요" (26 chars)
      → How did he get from forest to river?

      ✅ GOOD (shows transition):
      - Scene 2: "벤은 숲길을 따라서 천천히 걸어 내려갔어요" (26 chars)
      - Scene 3: "숲을 지나자 강가에 도착해서 쉬었답니다" (26 chars)
      → Shows movement from forest → river

   C. **Side characters - CRITICAL RULE FOR INTRODUCTION:**

      **MOST IMPORTANT: If the blueprint introduces a side character in a scene, you MUST mention them in the narration!**

      ❌ **WRONG - Skipping the introduction:**
      - Blueprint Scene 10: "Tom runs and notices a bird on the window"
      - Narration Scene 10: "톰은 방안을 가볍게 이리저리 뛰어다녔어요" (26 chars) ← Bird not mentioned!
      - Narration Scene 11: "그 새가 급히 톰에게 쿠션을 쓰라고 했어요" (26 chars) ← WHO IS THIS BIRD?!

      ✅ **CORRECT - Include the introduction:**
      - Blueprint Scene 10: "Tom runs and notices a bird on the window"
      - Narration Scene 10: "톰은 달리다가 창가에 앉은 새를 발견했어요" (26 chars) ← Bird introduced!
      - Narration Scene 11: "그 새가 급히 톰에게 쿠션을 쓰라고 했어요" (26 chars) ← Now we know the bird!

      **Rule:** If blueprint says "sees/notices/encounters" a side character, narration MUST include that visual introduction.

      **Natural integration after introduction:**
      - Use descriptive terms when names aren't needed: "새가", "개가", "현명한 부엉이가"
      - Only use names when it flows naturally in the story
      - Don't force formal introductions unless it makes sense

**HOW TO WRITE EACH SCENE:**

**SCENE 1:** Character Introduction
Blueprint format: "There was a [type] named {{name}} who [lived] at [location] and [goal]"
Extract: character type + name + where + goal
✅ GOOD (26 chars): "상냥한 소년 벤이 소나무골에서 폭포를 꿈꿨어요"
✅ GOOD (26 chars): "소나무골에 사는 소년 벤은 폭포를 보고 싶었어요"

**SCENES 2-8:** Action/Events
Blueprint: Character does X, something happens
Extract: WHO + WHAT happens (be specific!)
✅ GOOD (26 chars): "벤은 이른 아침 짐을 싸서 숲으로 출발했답니다"
✅ GOOD (26 chars): "벤은 배낭을 메고서 폭포를 향해 산길을 올랐어요"

**SCENE 9:** Ending
Blueprint: Goal achieved + lesson learned
Extract: WHAT achieved + WHAT learned
✅ GOOD (26 chars): "벤은 폭포에 도착해서 안전하다고 느꼈답니다"

**WHAT TO EXTRACT (Priority Order):**
1. WHO (character name) - always include
2. **NEW SIDE CHARACTER INTRODUCTION** - if blueprint mentions "sees/notices/encounters" a side character, MUST include in narration
3. WHAT (action/event) - must be specific
4. WHERE (location) - when it changes
5. HOW (method) - if space allows
6. EMOTION/THOUGHT - skip unless critical

**CRITICAL:** Never skip side character introductions even if you're tight on character count!

Example blueprint: "Ben walks through misty forest carefully watching step while thinking about grandmother"
Extract: WHO (Ben) + WHAT (walks through misty forest) + HOW (carefully)
Skip: thinking about grandmother (not critical)
✅ Write (26 chars): "벤은 안개 낀 숲길을 조심스럽게 걸어갔답니다"

**COMPLETE STORY FLOW EXAMPLE (6 SCENES):**

When read together, these should sound like ONE connected story:

1. "상냥한 소년 벤이 소나무골에서 폭포를 꿈꿨어요." (26 chars)
   → Introduces: Ben, Pine Valley, wants to see falls

2. "벤은 이른 아침에 짐을 싸서 그 폭포로 떠났어요." (26 chars)
   → References "그 폭포" (THE falls from Scene 1)
   → Action: packed bag, departed

3. "숲길을 걷다가 덤불에서 작은 여우를 발견했어요." (26 chars)
   → Location: forest path (natural continuation)
   → New element: fox (descriptive, no name needed)

4. "여우가 지름길을 알려 주며서 함께 걸어갔어요." (26 chars)
   → Helper role: shows shortcut
   → Using "여우가" (the fox) - no name needed, still natural

5. "숲을 지나며 점점 더 폭포 소리를 듣게 되었어요." (26 chars)
   → Progress: hearing waterfall (getting close!)
   → Fox still implied as companion without repetition

6. "벤은 폭포에 도착해서 안전하다고 느꼈답니다." (26 chars)
   → Goal achieved: arrived at falls
   → Lesson: felt safer together

✅ **Why this works:**
- Each line is exactly 26 characters (perfect!)
- Reads as ONE continuous story
- Scene 2 references "그 폭포" from Scene 1
- Locations flow naturally: village → forest path → deeper forest → at falls
- Side character (fox) integrated naturally without forced name introduction
- Clear beginning → middle → end with lesson

**INDIVIDUAL EXAMPLES:**

Blueprint: "There was a kind boy named Ben who lived in Pine Valley and dreamed of seeing Whispering Falls"
✅ GOOD (26 chars): "상냥한 소년 벤이 소나무골에서 폭포를 꿈꿨어요"
✅ GOOD (26 chars): "소나무골에 사는 소년 벤은 폭포를 보고 싶었어요"
❌ BAD (17 chars): "벤은 폭포를 보고 싶었어요" (too short - missing character type and location!)

Blueprint: "Ben meets a cloaked traveler on forest path"
✅ GOOD (26 chars): "벤은 숲길에서 망토 입은 나그네를 만났답니다"
✅ GOOD (26 chars): "숲길에서 망토 두른 나그네와 마주쳤답니다"
❌ BAD (9 chars): "망토의 나그네와" (incomplete sentence!)

Blueprint: "Traveler introduces himself as Mira"
✅ GOOD (26 chars): "나그네가 자신을 미라라고 소개하며 웃었어요"
✅ GOOD (26 chars): "그 나그네는 미라라는 이름을 알려 주었어요"

Blueprint: "Ben and Mira cross stepping stones together"
✅ GOOD (26 chars): "벤과 미라가 함께 징검다리를 건넜답니다"
✅ GOOD (26 chars): "벤과 미라는 함께 징검다리를 건넜어요"

**OUTPUT FORMAT:**
{{
  "story_title": "Short title in Korean",
  "scenes": [
    {{
      "scene_number": 1,
      "scene_type": "character",
      "narration_text": "26-27 char narration"
    }}
  ]
}}

**NOW:** Read the blueprint scenes. Extract the key facts. Write clear, specific narrations that tell the story.
"""

        # Format blueprint for context
        blueprint_str = json.dumps(blueprint, indent=2, ensure_ascii=False)

        user_prompt = f"""Transform this story blueprint into beautiful, engaging children's storybook narration.

STORY BLUEPRINT:
{blueprint_str}

Character: {character_name}
Language: {language}

**YOUR TASK:**
Write narration for each scene that creates ONE CONTINUOUS FLOWING STORY.

**CRITICAL REQUIREMENTS:**

**1. READ THE ENTIRE STORY FIRST:**
- Read ALL scenes before writing any narration
- Understand how scenes connect to each other
- Identify: What elements are introduced? What gets referenced later?

**2. PRIORITIZE CLARITY AND FLOW:**
- **NARRATION IS THE ONLY WAY LISTENERS UNDERSTAND THE STORY**
- Write natural, flowing children's storybook narration
- Avoid overly decorative or literary expressions that obscure meaning
- Focus on STORY CONTINUITY - how each scene connects to the next
- CLARITY and CONNECTION are more important than decorative beauty

**3. MAINTAIN NARRATIVE CONTINUITY:**
- Use "그 (the)" for elements already introduced: "그 꽃" (THE flower), not just "꽃" (a flower)
- Reference previous scenes when relevant: "강에서" (at the river), "그때" (at that moment)
- Each line should flow naturally from the previous one

**4. CHARACTER NAME RULES:**
- NEVER use a character's name before they're introduced in the story
- Scene N: "작은 새를 만났어요" (met a small bird) - no name
- Scene N+1: "그 새는 미라라고 했어요" (the bird said her name was Mira) - NOW introduce name
- Scene N+2: "미라와 함께 갔어요" (went with Mira) - NOW can use name

**5. CREATE OVERALL STORY CONSISTENCY:**
- Think: "How does this scene connect to what came before?"
- When read 1→2→3→4..., it should sound like ONE cohesive story, not disconnected sentences
- Each line advances the story and connects logically to previous line
- Listeners should always know: WHERE we are, WHAT is happening, WHY it matters
- No sudden jumps or confusing transitions

**6. MAXIMIZE CLARITY IN LIMITED SPACE:**
- With only 25-30 characters, CLARITY and FLOW > Decorative words
- Action Priority: WHO did WHAT (and WHY/HOW if space allows)
- Be CONCRETE and SPECIFIC - avoid vague or abstract language
- Each line must be INFORMATIVE - listeners depend on your words alone
- Maintain consistent 26-27 character length for all narrations

**GOAL:** Create narration that:
1. Reads like a COMPLETE, CONNECTED STORY (not isolated sentences)
2. Is CRYSTAL CLEAR - listeners understand the full story from audio alone
3. FLOWS NATURALLY from scene to scene with smooth transitions
4. Maintains proper length (26-27 chars) while staying clear and connected

Return your response as a JSON object with the format specified in the system prompt.
"""
        return self._get_json_response(system_prompt, user_prompt)

    def create_visual_blueprint(self, story_blueprint: dict, style: str) -> dict:
        """
        AGENT 2.5: Visual Blueprint Director - Creates detailed visual asset library
        Analyzes the full story and identifies all locations, objects, and visual elements
        Creates reusable, consistent descriptions for visual consistency
        """

        blueprint_str = json.dumps(story_blueprint, indent=2, ensure_ascii=False)

        system_prompt = f"""
You are a Visual Blueprint Director for an animation studio. Your job is to analyze a complete story and create a detailed VISUAL ASSET LIBRARY for consistent animation.

**YOUR CRITICAL ROLE:**
You ensure visual consistency across all scenes by creating detailed, reusable descriptions of locations and objects.

**YOUR JOB:**
1. Read the COMPLETE story (all scenes)
2. Identify ALL unique locations where scenes take place
3. Identify ALL important objects that appear in multiple scenes OR are crucial to the story
4. Create DETAILED, SPECIFIC descriptions for each location and object
5. Note which scenes use which locations/objects

**LOCATION DESCRIPTIONS (CRITICAL FOR CONSISTENCY):**
When scenes happen in the same place, they MUST look the same. Create SIMPLE, CLEAR descriptions.

**BALANCE IS KEY:**
- ✅ Clear enough that everyone understands
- ✅ Specific enough for consistency (especially COLORS)
- ❌ NOT overly complicated with too many details (AI gets confused!)

**What to include (KEEP IT SIMPLE):**
- **MAIN COLORS**: 2-3 key colors max (e.g., "cream walls", "green cabinets", "wood floor")
- **TYPE**: What kind of place (kitchen, garden, bedroom, forest path)
- **1-2 KEY FEATURES**: Most distinctive elements only (e.g., "large window", "stone fireplace")
- **LIGHTING**: General lighting (e.g., "bright sunlight", "warm afternoon light")

**Example GOOD location description (SIMPLE & CLEAR):**
"Cozy kitchen with cream walls, green cabinets, wooden countertops, large window, warm afternoon light"

**Example BAD location descriptions:**
❌ "Kitchen" (too vague - will look different each time)
❌ "Victorian-style kitchen with butter-cream walls, sage-green lower cabinets, white tile backsplash with tiny blue accent squares, wooden butcher-block countertops, white farmhouse sink beneath small window, pale oak plank floor, round wooden breakfast table..." (TOO COMPLICATED - AI can't match all these details!)

**OBJECT DESCRIPTIONS (CRITICAL FOR CONSISTENCY):**
When the same object appears in multiple scenes, it MUST look identical. Keep descriptions SIMPLE & CLEAR.

**BALANCE IS KEY:**
- ✅ Use well-known, easily understood terms
- ✅ Specify KEY COLOR for consistency
- ❌ NOT overly complicated (AI needs to actually generate it!)

**What to include (KEEP IT SIMPLE):**
- **MAIN COLOR**: 1-2 colors (e.g., "red ball", "blue backpack", "yellow cake")
- **TYPE**: What it is (ball, backpack, cake, book, etc.)
- **SIZE**: Simple size (small, medium, large)
- **1 KEY DETAIL**: Only if crucial for story (e.g., "striped", "with handle", "three layers")

**Example GOOD object descriptions (SIMPLE & CLEAR):**
✅ "Small red ball with white stripes"
✅ "Large blue backpack"
✅ "Three-layer yellow cake with pink frosting"

**Example BAD object descriptions:**
❌ "Ball" (too vague - what color? what size?)
❌ "Three-layer chocolate cake with dark chocolate frosting, covered in white chocolate shavings, sitting on a white ceramic cake stand with scalloped edges, topped with fresh strawberries arranged in circle, slightly worn edges showing age..." (TOO COMPLICATED - AI can't match all this!)

**WHAT OBJECTS TO DESCRIBE:**
1. **Objects that appear in 2+ scenes** (MUST describe for consistency)
   - Example: Magic wand used in scenes 2, 5, 8
   - **CRITICAL:** These need MORE specific details to ensure they look identical each time
   - Include: exact location/position, specific colors, distinctive features
   - Example: "Small round hole in bottom-left corner of wooden closet wall, dark interior"

2. **Objects crucial to the story** (describe even if only 1 scene)
   - Example: Treasure chest that story revolves around

3. **Objects characters interact with significantly**
   - Example: Cake being baked, sword being wielded

**WHAT OBJECTS TO SKIP:**
- Generic background items (random trees, clouds, flowers unless specific)
- Items mentioned only in passing
- Items that don't need to look identical

**CONSISTENCY RULE FOR REPEATED ELEMENTS:**
If an object/element appears in multiple scenes, it MUST have enough specific details to look identical:
- WHERE exactly (position/location within the scene)
- WHAT exactly (specific colors, size, distinctive features)
- This prevents the same element appearing in different places or looking different across scenes

**HOW TO IDENTIFY LOCATIONS:**
Look for:
- Explicit location names (kitchen, garden, mountain top, cave)
- Same setting across multiple scenes
- Location transitions (if character goes from A to B, both are locations)

**CRITICAL - EVERY SCENE NEEDS A LOCATION:**
- **Scene 1 MUST have a location** (character introduction needs a setting!)
- Even if scene description is vague, infer an appropriate location based on character type
- Examples for Scene 1:
  * Chef character → professional restaurant kitchen, home kitchen
  * Forest animal → forest clearing, woodland area, tree hollow
  * Child character → bedroom, playground, home interior, backyard
- **NO scenes should be missing from location assignments**
- If a scene isn't covered by defined locations, create a new location for it
- Every scene number from 1 to N must appear in at least one location's "appears_in_scenes" array

**OUTPUT FORMAT:**

{{
  "locations": [
    {{
      "location_id": "kitchen_1",
      "location_name": "Family Kitchen",
      "description": "Detailed visual description following guidelines above",
      "appears_in_scenes": [1, 3, 7, 9]
    }}
  ],
  "objects": [
    {{
      "object_id": "cake_1",
      "object_name": "Birthday Cake",
      "description": "Detailed visual description following guidelines above",
      "appears_in_scenes": [5, 7, 9]
    }}
  ],
  "visual_notes": {{
    "time_of_day_progression": "Story progresses from morning to evening",
    "weather": "Sunny throughout",
    "color_palette": "Warm tones, focus on yellows and oranges",
    "overall_mood": "Cheerful and hopeful"
  }}
}}

**CRITICAL RULES:**
1. **EVERY SCENE MUST HAVE A LOCATION**: Ensure all scenes (especially Scene 1) are assigned to a location
2. **SIMPLE BUT SPECIFIC**: Include colors and type, but don't overdo details
3. **Be CONSISTENT**: Same description = same visuals across scenes
4. **NO STYLE TAG**: Do NOT add "{style} art style" - the style is added later
5. **USE COMMON TERMS**: AI understands "house", "kitchen", "garden" - use clear, well-known words
6. **BALANCE**: Specific enough for consistency, simple enough for AI to generate

**EXAMPLE (for a baking story):**

{{
  "locations": [
    {{
      "location_id": "kitchen_main",
      "location_name": "Grandma's Kitchen",
      "description": "Cozy kitchen with cream walls, green cabinets, wooden table, large window, warm afternoon light",
      "appears_in_scenes": [1, 2, 5, 6, 8]
    }},
    {{
      "location_id": "garden_back",
      "location_name": "Backyard Garden",
      "description": "Small garden with stone path, vegetable beds, white fence, apple tree",
      "appears_in_scenes": [3, 4]
    }}
  ],
  "objects": [
    {{
      "object_id": "cake_birthday",
      "object_name": "Birthday Cake",
      "description": "Three-layer pink cake with rainbow sprinkles",
      "appears_in_scenes": [5, 6, 7, 8]
    }},
    {{
      "object_id": "mixing_bowl",
      "object_name": "Mixing Bowl",
      "description": "Large blue ceramic bowl with floral pattern",
      "appears_in_scenes": [2, 5]
    }}
  ],
  "visual_notes": {{
    "time_of_day_progression": "Morning (scenes 1-3) to afternoon (scenes 4-6) to evening (scenes 7-8)",
    "weather": "Sunny and warm throughout",
    "color_palette": "Warm and inviting - focus on creams, soft greens, pinks, natural wood tones",
    "overall_mood": "Heartwarming and nostalgic"
  }}
}}
"""

        user_prompt = f"""Analyze this complete story and create a SIMPLE, CLEAR visual asset library.

STORY BLUEPRINT:
{blueprint_str}

Art Style: {style}

**YOUR TASK:**
1. Read through ALL scenes carefully
2. Identify every unique location (scenes in same place = same location)
3. Identify important objects (appears multiple times OR crucial to story)
4. Write SIMPLE, CLEAR descriptions - NOT overly complicated!
5. Note which scenes use which assets

**CRITICAL - KEEP DESCRIPTIONS SIMPLE:**
- ✅ GOOD: "Cozy kitchen with cream walls, green cabinets, wooden table, large window"
- ❌ BAD: "Victorian-style kitchen with butter-cream walls, sage-green lower cabinets, white tile backsplash with tiny blue accent squares..."
- ✅ GOOD: "Three-layer pink cake with rainbow sprinkles"
- ❌ BAD: "Three-layer chocolate cake with dark chocolate frosting, covered in white chocolate shavings, sitting on white ceramic cake stand with scalloped edges..."

**WHY SIMPLE?**
- AI needs to actually GENERATE these - overly complicated = AI confusion
- Use well-known terms everyone understands ("house", "garden", "ball")
- Include COLORS for consistency, but keep other details minimal

**BALANCE:**
- Specific enough: Same description = same visuals
- Simple enough: AI can actually generate it
- Focus on: COLOR + TYPE + 1-2 key features max

Return your response as a JSON object with the format specified in the system prompt.
"""

        return self._get_json_response(system_prompt, user_prompt)

    def create_visual_prompts(self, blueprint: dict, visual_blueprint: dict, scenes_with_narration: list, character_name: str, character_type: str, character_prompt: str, style: str) -> dict:
        """
        AGENT 3: Visual Prompt Composer - Creates image generation prompts using visual asset library
        Composes prompts by referencing pre-defined locations, objects from visual blueprint
        """
        character_visual_context = f"\n- Visual Details: {character_prompt}\n  (For character scenes, this will be added via img2img)" if character_prompt else ""

        # Extract side characters info
        side_characters = blueprint.get("side_characters", [])
        side_characters_context = ""
        if side_characters:
            side_char_list = "\n".join([f"  * {char['name']}: {char['type']} - {char['description']}" for char in side_characters])
            side_characters_context = f"\n\n**SIDE CHARACTERS IN THIS STORY:**\n{side_char_list}\n  (Use these EXACT descriptions when these characters appear in scenes)"

        # Format visual blueprint for reference
        visual_blueprint_str = json.dumps(visual_blueprint, indent=2, ensure_ascii=False)

        system_prompt = f"""
You are a Visual Prompt Composer creating image generation prompts for animated storytelling.

**CRITICAL**: You have access to a VISUAL ASSET LIBRARY with pre-defined locations and objects. Your job is to COMPOSE prompts by REFERENCING these assets, not creating new descriptions.

**MAIN CHARACTER:**
- Name: {character_name}
- Type: {character_type}{character_visual_context}{side_characters_context}

**VISUAL ASSET LIBRARY (USE THESE EXACT DESCRIPTIONS!):**
{visual_blueprint_str}

**YOUR JOB:**
Compose image prompts by REFERENCING the asset library above. DO NOT create new descriptions - USE what's provided!

**HOW TO USE THE ASSET LIBRARY:**

1. **For each scene, check:**
   - Which location does this scene use? (look at location's "appears_in_scenes")
   - Which objects are in this scene? (look at object's "appears_in_scenes")
   - Use the EXACT descriptions from the library

2. **Compose the prompt:**
   - Start with location description (if location identified)
   - Add object descriptions (if objects present)
   - Add character actions/poses (for character scenes)
   - Add lighting/camera angle

**EXAMPLE:**
If scene 5 uses location "kitchen_main" and object "cake_birthday":
- Location description: "Cozy rustic kitchen with cream walls, vintage green cabinets..."
- Object description: "Three-layer pink cake with rainbow sprinkles..."
- Character action: "the curious cat reaching toward the cake"
- Result prompt: "{style}, Cozy rustic kitchen with cream walls, vintage green cabinets, checkered curtains, the curious orange cat with white paws reaching toward the three-layer pink cake with rainbow sprinkles on glass cake stand, warm afternoon sunlight – medium shot"

**SCENE TYPE HANDLING:**

**"character" scenes (img2img generation):**
- **Location**: Use EXACT location description from asset library (if scene uses a defined location)
- **Objects**: Include EXACT object descriptions from asset library (if scene includes defined objects)
- **Characters**: Describe actions/poses of characters present
  * DO NOT use character NAMES - use type descriptions: "the cat", "the fox", "the mouse"
  * Example: "the cat reaches toward the cake"
  * If multiple characters: "the cat and the mouse play together"
- **Composition**: Add camera angle, lighting

**"scenery" scenes (txt2img generation):**
- **Location**: Use EXACT location description from asset library
- **Objects**: Include any relevant objects from asset library
- NO characters visible at all
- Add atmospheric details, lighting, camera angle
- **NO OVERLAY TEXT**: Do NOT add dialogue, subtitles, or decorative text overlays
  * Text that's part of scene objects (posters, signs, books, newspapers) is OK if story-relevant

**CRITICAL RULES - READ CAREFULLY:**

1. **COPY WORD-FOR-WORD**: When a scene uses a location or object from the asset library, you MUST copy the ENTIRE description EXACTLY as written - NO SUMMARIES, NO PARAPHRASING, NO TRUNCATION (no "...")
   - ✅ CORRECT: Copy the full description exactly
   - ❌ WRONG: "Cozy kitchen..." or "kitchen with features..." (DO NOT SHORTEN!)

2. **VISUAL CONSISTENCY**: Using the same location/object description word-for-word ensures the images look identical across scenes

3. **NO CREATIVE ADDITIONS**: Do NOT add emotions, actions, or story elements to location/object descriptions - they describe WHAT THINGS LOOK LIKE (colors, shapes, materials) ONLY

4. **SEPARATE OBJECTS FROM ACTIONS**:
   - Objects/locations = static visual descriptions (from asset library)
   - Character actions = what character is DOING (you add this)
   - Keep them separate in the prompt!

5. **NO OVERLAY TEXT**: Do NOT add dialogue text, subtitles, captions, or decorative text overlays to any prompts. Text that's naturally part of scene objects (posters, signs, books, newspapers, letters) is acceptable if relevant to the story

**PROMPT STRUCTURE:**
`{style}, [EXACT location description from library], [EXACT object descriptions from library], [character action/pose], [lighting], no text – [camera angle]`

**IMPORTANT:** Always include "no text" in every prompt to prevent unwanted text generation in images

**Side Characters:**
- If a scene includes a side character (check characters_in_scene list), use their EXACT description
- NEVER invent new visual details for side characters
- Include them naturally in the scene composition alongside the main character

**CONTENT SAFETY - IMPORTANT:**
- When describing human side characters, avoid combining age descriptors ("young", "child", "boy", "girl") with detailed physical descriptions (clothing details, body positioning, hair details)
- Instead, focus on role/occupation: "helpful guide", "friendly traveler", "kind helper"
- Example: ❌ "the young boy with hair ruffling, wearing vest" → ✅ "the helpful guide in traveling clothes"
- This prevents content filter issues while maintaining story quality

**PROMPT LENGTH:**
- DO NOT worry about length - ACCURACY and CONSISTENCY are more important than brevity
- If a location description is 100 words, copy all 100 words - DO NOT SHORTEN
- Only add what's necessary: character action, lighting, camera angle

**EXAMPLES:**

Scene: "Blue the bird sits on branch feeling lonely"
Character Prompt: "curious blue bird with silver pendant, expressive eyes"
Type: character
Emotion: loneliness
CORRECT Prompt: "{style}, tree branch in sunny park, the bird perched alone looking down, warm afternoon sunlight – medium shot from slightly above"
WRONG: "Blue sitting on branch" ❌ (Don't use name!)

Scene: "Mimi meets a friendly butterfly in the garden"
Character Prompt: "curious orange fox with white paws, wearing blue scarf"
Type: character
CORRECT Prompt: "{style}, blooming flower garden, the fox reaching toward a small yellow butterfly hovering nearby, bright daylight – close-up shot"
WRONG: "Mimi meeting butterfly" ❌ (Don't use name!)

Scene: "Peaceful garden full of flowers"
Type: scenery
Emotion: tranquility
Prompt: "{style}, vibrant flower garden with stone pathway, butterflies fluttering, soft golden hour lighting – wide establishing shot"


**OUTPUT FORMAT:**
{{
  "image_prompts": [
    {{
      "scene_number": 1,
      "scene_type": "character" or "scenery",
      "prompt": "Complete detailed prompt starting with {style}"
    }}
  ]
}}

**CRITICAL REQUIREMENTS:**
- ALL prompts MUST start with: "{style}"
- **USE ASSET LIBRARY**: Copy exact location/object descriptions from the visual blueprint
- For "character" scenes: Location + Objects (from library) + Character actions
- For "scenery" scenes: Location + Objects (from library) + Atmosphere
- Maintain visual continuity by reusing exact asset descriptions
"""

        # Format context for the agent
        context = {
            "scene_blueprints": blueprint.get("scene_blueprints", []),
            "side_characters": blueprint.get("side_characters", []),
            "scenes_narration": scenes_with_narration
        }
        context_str = json.dumps(context, indent=2, ensure_ascii=False)

        user_prompt = f"""Compose detailed image prompts for each scene using the VISUAL ASSET LIBRARY provided above.

STORY CONTEXT:
{context_str}

Art Style: {style}
Character: {character_name} (a {character_type})

**YOUR PROCESS FOR EACH SCENE:**

**Step 1: Identify Assets**
- Check which location this scene uses (look at location "appears_in_scenes")
- Check which objects appear in this scene (look at object "appears_in_scenes")

**Step 2: Copy Exact Descriptions - NO TRUNCATION!**
- If scene uses location from library → copy THE COMPLETE location description WORD-FOR-WORD
- If scene includes objects from library → copy THE COMPLETE object descriptions WORD-FOR-WORD
- **CRITICAL**: DO NOT use "..." or shorten descriptions - copy EVERYTHING exactly as written!

**Step 3: Add Character Actions (for character scenes)**
- Describe what characters are doing (actions, poses, expressions)
- DO NOT use character NAMES - use types: "the cat", "the fox", "the mouse"
- Keep character actions SEPARATE from object/location descriptions

**Step 4: Compose Final Prompt**
Format: "{style}, [COMPLETE location description], [COMPLETE object descriptions], [character action], [lighting] – [camera angle]"

**CRITICAL RULES:**
- **NO TRUNCATION**: Copy the FULL description - if it's 200 characters, copy all 200!
- **NO PARAPHRASING**: Use the exact words from the asset library
- **NO "..." ELLIPSIS**: Never use "..." to shorten descriptions
- **CONSISTENCY**: Same location/object = IDENTICAL description every time

Generate {len(scenes_with_narration)} detailed image prompts, one for each scene.

**REMEMBER**: The asset library ensures consistency - same location/object ID = same visual description = identical appearance across scenes!

Return your response as a JSON object with the format specified in the system prompt.
"""
        return self._get_json_response(system_prompt, user_prompt)

    def create_video_prompts(self, blueprint: dict, scenes_with_narration: list, image_prompts: list, character_prompt: str, style: str) -> dict:
        """
        AGENT 4: Motion Director - Creates animation prompts for image-to-video
        Describes the MOVEMENT and ACTION that brings the still image to life
        """
        character_movement_hints = ""
        if character_prompt:
            character_movement_hints = f"\n\n**MAIN CHARACTER DETAILS FOR MOVEMENT:**\n{character_prompt}\n\nCreate character-specific movements based on these visual details."

        # Extract side characters info
        side_characters = blueprint.get("side_characters", [])
        if side_characters:
            side_char_list = "\n".join([f"  * {char['name']}: {char['type']} - {char['description']}" for char in side_characters])
            character_movement_hints += f"\n\n**SIDE CHARACTERS FOR MOVEMENT:**\n{side_char_list}\n\nAnimate these characters consistently when they appear."

        system_prompt = f"""
You are a Motion Director creating animation prompts for image-to-video generation (Kling AI).

**CRITICAL UNDERSTANDING:**
- The IMAGE already contains ALL visual details (character appearance, environment, colors, lighting)
- Your job: Describe ONLY the MOTION and CAMERA MOVEMENTS - NOT what things look like
- Duration: 5 seconds per scene

**WHAT TO DESCRIBE (ONLY 2 THINGS):**

**1. CHARACTER ACTIONS/MOVEMENTS:**
   - What the character DOES (walks, turns, reaches, sits, runs, follows, etc.)
   - **Include important details:**
     * Direction of movement (left, right, forward, upward, downward)
     * If character is following another, leading, or interacting
     * Speed or manner (slowly, quickly, carefully, eagerly)
   - **NEVER use character NAME** - use type: "the cat", "the fox", "the bird", "the mouse"
   - If multiple characters, specify interactions and who does what
   - Examples:
     * ✅ "The cat walks forward and upward along the path"
     * ✅ "The mouse follows behind the cat, moving in the same direction"
     * ✅ "The fox reaches toward the butterfly with its right paw"
     * ✅ "The bird flies down from above while the cat looks upward"
     * ❌ "Mimi walks forward" (don't use name!)
     * ❌ "The curious orange fox with white paws walks" (don't describe appearance - already in image!)

**2. CAMERA MOVEMENTS:**
   - **Push in / Dolly in**: Move closer to subject
   - **Pull back / Track backward**: Move away from subject
   - **Pan left/right**: Horizontal sweep
   - **Tilt up/down**: Vertical movement
   - **Zoom in/out**: Change focal length
   - **Hold steady / Static**: No camera movement
   - Keep it simple: "Camera pushes in", "Slight pan right", "Hold steady"

**WHAT NOT TO DESCRIBE:**
- ❌ Character appearance (hair color, clothing, features) - already in image!
- ❌ Environment details (trees, flowers, clouds, lighting) - already in image!
- ❌ Emotions through descriptions - show through ACTIONS only
- ❌ Long detailed descriptions - keep it SHORT and ACTION-focused

**PROMPT STRUCTURE:**
`[Character action]. [Camera movement].`

**GOOD EXAMPLES (from working system):**

"Dolly in toward the lobby as the penguin enters. Slight zoom in on the tub."

"Tilt down from the penguin's face to the tub as it sets the rubber duck on the rim."

"Pan right to reveal the penguin carefully applying the clay mask."

"Track backward as the penguin waddles down the hallway toward the exit."

**BAD EXAMPLES (too descriptive):**

❌ "The medium-gray house cat with emerald eyes strolls down the lane, whiskers perking, while leaves and dandelions bob in a light breeze and clouds drift. Camera pushes in."
→ Why bad: Describes appearance and environment (already in image!)

✅ CORRECT: "The cat strolls down the lane. Camera pushes in from street level."

**CRITICAL RULES:**
1. **BE DETAILED BUT FOCUSED**: 2-4 sentences describing movement with important details
2. **INCLUDE DIRECTIONAL DETAILS**: Specify left/right, up/down, following/leading
3. **ACTION ONLY**: What happens, not what things look like
4. **NO NAMES**: Use "the cat", "the mouse", "the bird", not character names
5. **NO APPEARANCE**: Don't describe colors, features, clothing (already in image!)
6. **CAMERA SIMPLE**: "Push in", "Pan right", "Hold steady" - no fancy descriptions
7. **CHARACTER INTERACTIONS**: If multiple characters, describe who follows whom, who leads, spatial relationships

**OUTPUT FORMAT:**
{{
  "video_prompts": [
    {{
      "scene_number": 1,
      "prompt": "Character action. Camera movement."
    }}
  ]
}}
"""

        # Format context
        context = {
            "scene_blueprints": blueprint.get("scene_blueprints", []),
            "side_characters": blueprint.get("side_characters", []),
            "scenes": scenes_with_narration,
            "image_prompts": image_prompts
        }
        context_str = json.dumps(context, indent=2, ensure_ascii=False)

        user_prompt = f"""Create simple, direct motion prompts for image-to-video generation.

STORY CONTEXT:
{context_str}

**YOUR PROCESS FOR EACH SCENE:**

1. **Read the scene blueprint**: What action happens?
2. **Read the narration**: What's the key moment?
3. **Check for character interactions**: Are multiple characters present? Who follows, who leads?
4. **Determine direction**: Which way is movement going? (left/right, up/down, forward/back)
5. **Write the motion prompt**: 2-4 sentences with specific movement details

**PROMPT FORMAT:**
`[What character does with direction/details]. [If multiple characters, their interaction]. [Camera movement].`

**RULES:**
- **NO character names**: Use "the cat", "the fox", "the bird", "the mouse"
- **NO appearance descriptions**: Already in the image!
- **NO environment descriptions**: Already in the image!
- **INCLUDE DIRECTIONS**: left, right, upward, downward, forward, backward
- **INCLUDE INTERACTIONS**: following, leading, together, watching, approaching
- **ACTION + CAMERA with details**: What moves, how, and where
- **2-4 sentences**: Include important movement details

**EXAMPLES:**

Scene: Cat walks down street
✅ GOOD: "The cat strolls down the lane. Camera pushes in from street level."
❌ BAD: "The medium-gray house cat with emerald eyes strolls hopefully down the sunny lane, whiskers perking, while leaves bob in the breeze. Camera pushes in."

Scene: Mouse grabs cheese
✅ GOOD: "The mouse darts in and snatches the cheese. Camera follows with quick pan down."
❌ BAD: "The small brown mouse with quick paws and playful smirk darts in, grabs cheese, tail whipping. Sunlight glints. Camera pans."

Scene: Characters sit together
✅ GOOD: "The cat, mouse, and bird sit together. Camera slowly pulls back."
❌ BAD: "The cat breathes calmly with relaxed ears, the mouse leans back satisfied, the bird fluffs feathers. Sunbeams soften, dust motes drift. Camera pulls back."

**REMEMBER:**
- The image already shows everything - you only describe MOTION
- Keep it simple like the penguin spa examples
- Focus on what MOVES, not what things LOOK like

Generate {len(scenes_with_narration)} simple motion prompts (2-3 sentences each).

Return your response as a JSON object with the format specified in the system prompt.
"""
        return self._get_json_response(system_prompt, user_prompt)

    # --- ✨ THIS IS THE NEW "SINGLE PROTAGONIST" DIRECTOR AGENT ---
    def create_story_and_character(self, idea: str, num_scenes: int) -> dict:
        system_prompt = f"""
You are a meticulous and strict Art Director and Script Supervisor for an AI animation pipeline. You are creating a short story that revolves around a SINGLE MAIN CHARACTER.

**Your Process & Rules:**

**1. Language Analysis & Control:**
   - **Primary Rule:** Analyze the user's `idea` to determine if it is in Korean.
   - **If Korean:** The `story_narrative` MUST be in Korean.
   - **For ALL OTHER languages:** The `story_narrative` MUST be in **English**.
   - **CRITICAL:** The `character` description and all scene `description` fields MUST ALWAYS be in **English**.

**2. Narrative Writing:**
   - Write an engaging story in a narrative style (like a children's book). The story MUST focus on a single protagonist. Other characters can appear, but only alongside the main character.

**3. Scene Breakdown & Classification:**
   - Break the narrative into {num_scenes} distinct "single-shot" scenes.
   - **Scene Classification Rule:** You must classify each scene's `scene_type` using ONLY these two options:
       - `"character"`: Use this for any scene where the main character is present, even if other characters are also there.
       - `"scenery"`: Use this ONLY for establishing shots of locations or objects where NO characters are present.
   - **Scenery Purity Rule:** A `scenery` scene description MUST NOT contain any characters.
   - **Scenery Ratio:** Use `scenery` sparingly (2 times max in a 6-scene story).

**Your output MUST be a single, valid JSON object with `character`, `story_narrative`, and `scenes`.**
"""
        user_prompt = f"Execute your process for the user idea to create a story about a single protagonist with exactly {num_scenes} scenes. User idea: '{idea}'"
        return self._get_json_response(system_prompt, user_prompt)

    def create_narration_script(self, character_name: str, character_type: str, personality: str, themes: str, num_scenes: int, language: str = "Korean") -> dict:
        """
        Generate a cohesive narration script with MEANINGFUL story arc and emotional depth.
        Each line is limited to ~30 Korean characters (or ~50 English characters).
        FOCUSES ONLY ON THE MAIN CHARACTER - no recurring secondary characters.
        """
        system_prompt = f"""
You are a master children's storyteller creating emotionally resonant, meaningful narratives. Your stories must have DEPTH, CONNECTION, and PURPOSE.

**STORY PHILOSOPHY:**
- Every story needs a MEANINGFUL MESSAGE (courage, kindness, discovery, growth)
- Scenes must CONNECT logically - each scene builds on the previous
- Character must have an EMOTIONAL JOURNEY (from wanting → trying → learning → growing)
- The story should touch children's hearts, not just entertain

**CRITICAL REQUIREMENTS:**

**1. MEANINGFUL NARRATIVE ARC:**
   - **Beginning**: Character has a desire/problem/wonder (establishes emotional stake)
   - **Middle**: Character faces challenges/discovers/explores (builds tension and meaning)
   - **Climax**: Character experiences a meaningful moment (realization, achievement, connection)
   - **End**: Character grows/learns something valuable (emotional payoff with message)

   Example Arc:
   - Scene 1 (scenery): "밤하늘에 별들이 쏟아져 내리고 있었어요" (establishes wonder)
   - Scene 2: "{character_name}이 외로움을 느끼며 창밖을 보았어요" (desire: connection)
   - Scene 3: "용기를 내어 별빛을 따라 걸어가기 시작했답니다" (action toward desire)
   - Scene 4: "높은 언덕에 올라 별들과 가까워졌어요" (climax: achieving goal)
   - Scene 5: "혼자가 아니란 걸 깨달으며 미소 지었답니다" (resolution: emotional growth)

**2. SINGLE PROTAGONIST RULE:**
   - Story focuses ONLY on {character_name}
   - NO recurring secondary characters (no friends, companions)
   - Can interact with environment (wind, stars, flowers) but these must be METAPHORICAL or SYMBOLIC
   - Example GOOD: "{character_name}이 바람에게 이야기를 들려주었어요" (wind = element, not character)
   - Example BAD: "{character_name}이 토끼 친구를 만났어요" (rabbit = needs visual consistency)

**3. SCENE CONNECTIONS:**
   - Each scene must LOGICALLY follow the previous
   - Use transition words/concepts: "그때", "그러나", "마침내", "그래서"
   - Cause and effect: Scene 2 happens BECAUSE of Scene 1
   - Emotional progression: lonely → curious → brave → joyful → wise

**4. Scene Type Rules:**
   - `scenery`: Pure environment establishing mood/setting
     - Do NOT mention {character_name} by name
     - Set up emotional atmosphere for next scene
     - Example: "어두운 숲에 달빛만이 비추고 있었어요" (sets mysterious mood)

   - `main_character`: {character_name} visible and active
     - Show character's FEELINGS and THOUGHTS, not just actions
     - Example GOOD: "{character_name}이 두려움을 이겨내며 앞으로 나아갔어요"
     - Example BAD: "{character_name}이 걸었어요" (no emotion)

**5. Storytelling Quality:**
   - Use rich, evocative Korean: "~했답니다", "~되었어요", "~하고 말았어요"
   - Include EMOTIONS: 두근거리는, 설레는, 외로운, 따뜻한, 행복한
   - Include SENSORY details: 반짝이는, 부드러운, 따스한, 조용한
   - Create ATMOSPHERE: Each line should paint a vivid picture
   - Flow like poetry: rhythm, beauty, meaning in every word

**6. Themes Integration:**
   - Weave themes ({themes}) NATURALLY into the story
   - Don't just mention themes - SHOW them through character's journey
   - Example for "우정" theme: Show loneliness → reaching out → finding connection within self

**7. Character Length Limits:**
   - **Korean**: 25-35 characters max (including spaces)
   - **English**: 40-50 characters max
   - Pack MEANING into brevity - every word counts

**8. Language:**
   - {language} narration with LITERARY quality
   - Read like a beloved children's book
   - Avoid mechanical sentences - create MAGIC

**Your output MUST be a valid JSON object with:**
- `story_title`: Evocative title reflecting the story's meaning (in {language})
- `scenes`: Array with:
  - `scene_number`: Integer (1, 2, 3...)
  - `scene_type`: "character" or "scenery"
  - `narration_text`: Meaningful, connected narration line

**Example of MEANINGFUL story (showing emotional arc and connections):**
{{
  "story_title": "마음속 별을 찾아서",
  "scenes": [
    {{"scene_number": 1, "scene_type": "scenery", "narration_text": "깊은 밤, 별들이 하늘에서 외롭게 빛나고 있었어요."}},
    {{"scene_number": 2, "scene_type": "character", "narration_text": "{character_name}도 혼자라고 느끼며 창밖을 보았답니다."}},
    {{"scene_number": 3, "scene_type": "character", "narration_text": "용기를 내어 별빛을 향해 걸어가기 시작했어요."}},
    {{"scene_number": 4, "scene_type": "character", "narration_text": "높은 언덕에서 별과 하나가 된 기분을 느꼈답니다."}},
    {{"scene_number": 5, "scene_type": "character", "narration_text": "별처럼 빛나는 마음을 발견하고 미소 지었어요."}}
  ]
}}

Notice: Emotional journey (lonely → brave → connected → empowered), scenes connect logically, meaningful message (finding light within), evocative language.
"""
        user_prompt = f"""Create a {language} narration script for exactly {num_scenes} scenes.

Character: {character_name} (a {character_type})
Personality: {personality}
Themes: {themes}

CRITICAL REMINDERS:
- ONLY focus on {character_name} - NO recurring secondary characters
- Scenery scenes must NOT mention {character_name} by name
- Use flowing, literary storytelling language in {language}
- Each line should feel like it's from a children's storybook
- Respect character limits strictly
- Story has clear beginning, middle, and end
"""
        return self._get_json_response(system_prompt, user_prompt)

    def create_character_image_prompts(self, character_description: str, style: str, themes: list[str] = None, custom_theme: str = "") -> list[str]:
        # Build story context
        story_context = ""
        if themes or custom_theme:
            story_context = "\n\n**Story Context:**\n"
            if themes:
                story_context += f"- Themes: {', '.join(themes)}\n"
            if custom_theme:
                story_context += f"- Story idea: {custom_theme}\n"
            story_context += "Use this context to infer the appropriate character type.\n"

        system_prompt = f"""
You are a professional character designer creating clean character images for animation.

**CHARACTER INFORMATION:**
{character_description}
{story_context}

**CRITICAL REQUIREMENTS:**

1. **Character Specificity & Context Awareness:**
   - Analyze character name, description, and story context together
   - If story references known characters, infer the type (e.g., 'Tom and Jerry' + name 'Tom' = cat)
   - For HUMAN type: DO NOT use "human" or "person" - determine gender/age from name (girl names → young girl, boy names → young boy)
   - For ANIMAL type: Specify exact animal based on context clues
   - Generate ONE specific character only

2. **View & Pose:**
   - Front-facing view, character looking at camera
   - Standing upright in neutral pose
   - Full body visible, centered in frame

3. **Background:**
   - Pure white background or subtle neutral gradient
   - NO environment, props, text, or labels

4. **Art Style:**
   - MUST strictly follow this style: **{style}**
   - Clean lines and clear details

5. **Character Details:**
   - All defining features clearly visible
   - Accurate clothing, accessories, colors
   - Neutral or slightly friendly expression

6. **Lighting:**
   - Even, flat lighting
   - No dramatic shadows

**Prompt Format:**
"{style}, front view, [ONE specific character], full body, standing pose, centered, white background, no text, clean design, high quality"

**Your output MUST be a valid JSON object with:**
- "prompts": A list of exactly two detailed prompt strings

Each prompt creates a slight variation of the SAME character (different expression or pose).
"""
        user_prompt = f"Generate two clean, front-facing character prompts for: '{character_description}'"
        return self._get_json_response(system_prompt, user_prompt)["prompts"]

    def create_side_character_image_prompt(self, character_name: str, character_type: str, character_description: str, style: str, main_character_prompt: str = "") -> str:
        """
        Generate a detailed image prompt for a side character that matches the main character's visual style.
        """
        main_char_context = ""
        if main_character_prompt:
            main_char_context = f"\n\n**Main Character's Visual Style Reference:**\n{main_character_prompt}\n\nThe side character should match this visual style and rendering quality."

        system_prompt = f"""
You are a professional character designer creating side characters that visually match the main character's style.

**SIDE CHARACTER:**
- Name: {character_name}
- Type: {character_type}
- Description: {character_description}

**STYLE:**
{style}{main_char_context}

**CRITICAL REQUIREMENTS:**

1. **EXACT CHARACTER MATCH (MOST IMPORTANT!):**
   - The character description is: **{character_description}**
   - ❌ DO NOT change gender (grandfather ≠ grandmother!)
   - ❌ DO NOT change age (elderly ≠ young!)
   - ❌ DO NOT change species/type (cat ≠ dog!)
   - ✅ Use the EXACT type and description provided
   - If description says "grandfather" → must be male elderly character
   - If description says "grandmother" → must be female elderly character
   - **This is NON-NEGOTIABLE - follow the description EXACTLY**

2. **View & Pose:**
   - Front-facing view looking at camera
   - Standing upright in neutral pose
   - Full body visible from head to toe
   - Centered in frame

3. **Background:**
   - Pure white background or very subtle neutral gradient
   - NO environment elements, props, or scenery
   - Clean and simple

4. **Art Style:**
   - MUST strictly follow: **{style}**
   - Match the visual rendering quality and style of the main character

5. **Lighting:**
   - Even, flat lighting that shows all details clearly
   - No dramatic shadows

**Prompt Format:**
Start with: "{style}, front view, [EXACT character type and description - DO NOT CHANGE], full body, standing pose, centered, white background, clean design"

**EXAMPLE:**
If description = "kind elderly grandfather with gray beard and glasses"
CORRECT: "{style}, front view, kind elderly grandfather with gray beard and glasses, full body..."
WRONG: "{style}, front view, kind elderly grandmother..." ❌ (Changed gender!)
WRONG: "{style}, front view, kind old man..." ❌ (Lost details!)

**Your output MUST be a valid JSON object with:**
- "prompt": A single detailed prompt string for this side character

**CRITICAL:** The prompt MUST include the EXACT character type and description from the input. DO NOT modify, substitute, or interpret it differently.

DO NOT include any explanations, only the JSON output.
"""
        user_prompt = f"Generate the image prompt for side character: {character_name} ({character_type})"
        response = self._get_json_response(system_prompt, user_prompt)
        return response.get("prompt", f"{character_description}, {style}, front view, full body, white background")

    def create_style_conversion_prompts(self, style: str, character_description: str = "") -> list[str]:
        """
        Generate 2 detailed img2img prompts to use an uploaded image as reference and create clean character variations.
        The character_description comes from GPT-4 Vision analysis of the uploaded image.
        Returns a list of 2 prompts, similar to create_character_image_prompts.
        """
        char_info = ""
        if character_description:
            char_info = f"\n\n**Character Description from Image Analysis:**\n{character_description}\n"

        system_prompt = f"""
You are a professional character designer. Create 2 img2img prompts that use an uploaded image as reference to generate clean character variations.
{char_info}
**CRITICAL REQUIREMENTS:**

1. **Use Description & Reference:**
   - Use the character description to create detailed prompts
   - Preserve the character's identity, features, and appearance
   - Maintain character type, age, gender, and key distinctive features

2. **Create Clean Character Image:**
   - Front-facing view, character looking at camera
   - Standing upright in neutral pose
   - Full body visible, centered in frame

3. **Background:**
   - Pure white background or subtle neutral gradient
   - NO environment, props, text, or labels

4. **Art Style:**
   - MUST strictly follow this style: **{style}**
   - Clean lines and clear details

5. **Character Details:**
   - Preserve features, clothing, and colors
   - Even, flat lighting

6. **Create 2 Variations:**
   - First prompt: Neutral or slightly friendly expression
   - Second prompt: Cheerful and energetic expression
   - Both should be the SAME character with different expressions

**Prompt Format:**
"{style}, front view, [character details from description], full body, standing pose, [expression], centered, pure white background, clean design, high quality"

**Your output MUST be a JSON object with:**
- "prompts": A list of exactly two detailed prompt strings

Each prompt creates a slight variation of the SAME character (different expression).
DO NOT include any explanations, only the JSON output.
"""
        user_prompt = f"Generate 2 img2img character creation prompts for: {style}"
        response = self._get_json_response(system_prompt, user_prompt)
        prompts = response.get("prompts", [
            f"{style}, front view, character from reference, full body, standing pose, neutral expression, white background, clean design",
            f"{style}, front view, character from reference, full body, standing pose, cheerful expression, white background, clean design"
        ])
        return prompts

    # --- ✨ UPDATED to remove 'secondary_character_scene' logic ---
    def create_master_storyboard(self, story_data: dict, style: str) -> dict:
        """
        Generates ALL image and video prompts for the entire story in a single,
        context-aware run to ensure visual and narrative cohesion.
        ENFORCES: Only main character consistency, no secondary characters.
        """
        system_prompt = f"""
You are a world-class Director of Photography for an AI animation studio. Your task is to take a complete story script and a style guide and generate a full storyboard with all the necessary prompts.

**CRITICAL GOAL: VISUAL COHESION & CHARACTER CONSISTENCY**
The prompts must create a sequence of images and videos that feel like they are from the SAME film. Lighting and color must transition logically.

**SCENE TYPE HANDLING:**

1. **"character" scene (uses img2img with character reference):**
   - Character reference images will be provided to the AI
   - Your prompt should describe the SCENE, ENVIRONMENT, and ACTIONS
   - DO NOT describe character appearances (they're in the reference images)
   - You can mention generic background elements: "surrounded by butterflies", "trees swaying", "flowers blooming"
   - Example GOOD: "{style}, Character playing in a sunny meadow with butterflies flying around – Bright daylight – Medium shot; Character jumping joyfully among wildflowers."

2. **"scenery" scene (pure environment, NO img2img):**
   - NO characters should be visible AT ALL
   - Focus only on environment, mood, atmosphere
   - Sets up the location/mood for the next scene
   - Example: "{style}, Deep forest with sunlight filtering through leaves – Dappled light – Wide shot; Peaceful forest clearing with morning mist."

**IMAGE PROMPT FORMAT:**
-   You MUST generate one image prompt for every scene provided.
-   The art style is fixed: **{style}**. This MUST be the first part of every prompt.
-   Format: `{style}, [Setting/Action] – [Lighting] – [Camera Shot]; [Composition details].`
-   Keep prompts focused on environment and mood
-   Avoid introducing secondary characters that would appear across multiple scenes

**VIDEO PROMPT RULES:**
-   You MUST generate one video prompt for every scene provided.
-   The prompt must describe a SINGLE, simple, continuous camera movement
-   Focus on camera motion, not character actions
-   Examples: "The camera slowly dollies forward", "The camera gently pans right", "The camera tilts up to reveal the sky"
-   Keep it simple and cinematic

**CONSISTENCY RULES:**
-   Maintain consistent lighting mood throughout the story (unless intentional transition)
-   Color palette should feel cohesive across all scenes
-   Camera shot variety: mix wide shots, medium shots, and close-ups
-   Transitions should feel natural (don't jump from night to day abruptly)

**Your output MUST be a single, valid JSON object with two keys:**
1.  `image_prompts`: A list of strings, one for each scene.
2.  `video_prompts`: A list of strings, one for each scene.
"""
        full_context = json.dumps(story_data, indent=2)
        user_prompt = f"""Here is the complete story data and style guide. Generate the master storyboard JSON based on it.

CRITICAL REMINDERS:
- main_character scenes: Focus on environment and action, NOT character appearance (reference image provides that)
- scenery scenes: Pure environment only, NO characters
- NO secondary characters that need visual consistency
- Generic elements only (butterflies, trees, flowers, etc.)

Story Data:
```json
{full_context}
```"""
        return self._get_json_response(system_prompt, user_prompt)

llm_agent = LLMAgent()