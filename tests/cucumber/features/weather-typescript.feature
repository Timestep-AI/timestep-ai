Feature: Weather widget with TypeScript backend

  @retries(0)
  Scenario: Get weather using TypeScript backend
    Given I am a new anonymous user
    And I select the "TypeScript" backend
    And I open the chat for agent "Personal Assistant"
    When I run the weather conversation flow
    Then the conversation should complete successfully
