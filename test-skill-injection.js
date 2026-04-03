// Test script to verify skill injection
// Run this in the browser console when the Keel app is loaded

async function testSkillInjection() {
    console.log('🔍 Testing skill injection...');
    
    try {
        // Test 1: Check if skills engine is available
        if (typeof skillsEngine !== 'undefined') {
            console.log('✅ Skills engine available');
            
            // Test 2: Get available skills
            const availableSkills = skillsEngine.getAvailableSkillsMetadata();
            console.log('📋 Available skills:', availableSkills.map(s => s.name));
            
            // Test 3: Test skill selector directly
            const testTask = "what is the difference between cats and dogs?";
            console.log('🎯 Testing task:', testTask);
            
            // Execute skill selector
            const result = await skillsEngine.executeSkill('skill-selector', {
                task: testTask
            }, {
                pythonRuntime: window.python,
                userMessage: testTask,
                conversationHistory: [],
                timeout: 30000
            });
            
            console.log('📊 Skill selector result:', result);
            
            if (result.success) {
                const selection = JSON.parse(result.output);
                console.log('🎯 Selected skill:', selection.selected_skills[0]?.skill);
                console.log('📈 Confidence:', selection.selected_skills[0]?.confidence);
                console.log('💭 Reasoning:', selection.selected_skills[0]?.reasoning);
                
                const expectedSkill = 'research';
                const actualSkill = selection.selected_skills[0]?.skill;
                
                if (actualSkill === expectedSkill) {
                    console.log('✅ SUCCESS: Research skill selected correctly!');
                } else {
                    console.log('❌ FAILURE: Expected research, got', actualSkill);
                }
            } else {
                console.log('❌ Skill selector failed:', result.error);
            }
            
        } else {
            console.log('❌ Skills engine not available');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Auto-run the test
console.log('🚀 Starting skill injection test...');
setTimeout(testSkillInjection, 2000);

// Also provide a manual test function
window.testSkillInjection = testSkillInjection;
