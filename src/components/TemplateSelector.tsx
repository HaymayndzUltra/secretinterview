import React from 'react';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';

interface TemplateSelectorProps {
  className?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ className = '' }) => {
  const {
    availableTemplates,
    selectedTemplate,
    loadTemplateContent,
    setSelectedTemplate,
    setTemplateContent
  } = useKnowledgeBase();

  const handleTemplateChange = async (templateName: string) => {
    if (templateName === '') {
      setSelectedTemplate(null);
      setTemplateContent(null);
    } else {
      await loadTemplateContent(templateName);
    }
  };

  return (
    <div className={`form-control ${className}`}>
      <label className="label">
        <span className="label-text">Prompt Template</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={selectedTemplate || ''}
        onChange={(e) => handleTemplateChange(e.target.value)}
      >
        <option value="">No Template</option>
        {availableTemplates.map((template) => (
          <option key={template.name} value={template.name}>
            {template.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </option>
        ))}
      </select>
      {selectedTemplate && (
        <div className="mt-2 p-2 bg-base-200 rounded-lg">
          <div className="text-sm text-base-content/70">
            Template: <span className="font-medium">{selectedTemplate.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
