import React from 'react';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';
import { getAllScenarios } from '../utils/promptBuilder';

const ScenarioSelector: React.FC = () => {
  const { selectedScenario, setSelectedScenarioById } = useKnowledgeBase();
  const scenarios = getAllScenarios();

  const handleScenarioChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedScenarioById(event.target.value);
  };

  return (
    <div className="mb-4">
      <label className="label">
        <span className="label-text">Interview Scenario</span>
      </label>
      <select
        value={selectedScenario.id}
        onChange={handleScenarioChange}
        className="select select-bordered w-full"
      >
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name}
          </option>
        ))}
      </select>
      <div className="text-sm text-gray-600 mt-1">
        {selectedScenario.description}
      </div>
    </div>
  );
};

export default ScenarioSelector;
