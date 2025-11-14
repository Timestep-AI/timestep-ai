Feature: Cross-backend approval with TypeScript start

  @retries(0)
  Scenario: Start with TypeScript, switch to Python for approval
    Given I am a new anonymous user
    And I select the "TypeScript" backend
    And I open the chat for agent "Personal Assistant"
    When I run the cross-backend approval flow starting with TypeScript
    Then the conversation should complete successfully

