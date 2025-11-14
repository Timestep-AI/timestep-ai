Feature: Cross-backend approval with Python start

  @retries(0)
  Scenario: Start with Python, switch to TypeScript for approval
    Given I am a new anonymous user
    And I select the "Python" backend
    And I open the chat for agent "Personal Assistant"
    When I run the cross-backend approval flow starting with Python
    Then the conversation should complete successfully

