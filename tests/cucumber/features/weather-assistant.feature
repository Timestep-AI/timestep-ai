Feature: Weather Assistant chat flow

  @retries(0)
  Scenario: Handle math and weather queries without handoffs
    Given I am a new anonymous user
    And I open the chat for agent "Weather Assistant"
    When I run the math-weather conversation flow
    Then the conversation should complete successfully
