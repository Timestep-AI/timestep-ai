Feature: Theme switching with Python backend

  @retries(0)
  Scenario: Switch theme using Python backend
    Given I am a new anonymous user
    And I select the "Python" backend
    And I open the chat for agent "Personal Assistant"
    When I run the theme switching conversation flow
    Then the conversation should complete successfully

