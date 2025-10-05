import React, { useState } from 'react';
import { ProfileSummary } from '../contexts/KnowledgeBaseContext';
import { FaEdit, FaSave, FaTimes, FaPlus, FaTrash } from 'react-icons/fa';

interface ProfileSummaryCardProps {
  profileSummary: ProfileSummary | null;
  onUpdateProfile: (updatedProfile: ProfileSummary) => void;
  onClearProfile: () => void;
}

const ProfileSummaryCard: React.FC<ProfileSummaryCardProps> = ({
  profileSummary,
  onUpdateProfile,
  onClearProfile
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ProfileSummary | null>(null);

  // Initialize edited profile when entering edit mode
  const handleEdit = () => {
    if (profileSummary) {
      setEditedProfile({ ...profileSummary });
      setIsEditing(true);
    }
  };

  // Save changes and exit edit mode
  const handleSave = () => {
    if (editedProfile) {
      onUpdateProfile(editedProfile);
      setIsEditing(false);
      setEditedProfile(null);
    }
  };

  // Cancel editing and revert changes
  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile(null);
  };

  // Add new item to a specific category
  const handleAddItem = (category: keyof ProfileSummary) => {
    if (editedProfile) {
      setEditedProfile({
        ...editedProfile,
        [category]: [...editedProfile[category], '']
      });
    }
  };

  // Update an item in a specific category
  const handleUpdateItem = (category: keyof ProfileSummary, index: number, value: string) => {
    if (editedProfile) {
      const updatedCategory = [...editedProfile[category]];
      updatedCategory[index] = value;
      setEditedProfile({
        ...editedProfile,
        [category]: updatedCategory
      });
    }
  };

  // Remove an item from a specific category
  const handleRemoveItem = (category: keyof ProfileSummary, index: number) => {
    if (editedProfile) {
      const updatedCategory = editedProfile[category].filter((_, i) => i !== index);
      setEditedProfile({
        ...editedProfile,
        [category]: updatedCategory
      });
    }
  };

  // Render a category section
  const renderCategory = (
    title: string,
    category: keyof ProfileSummary,
    items: string[]
  ) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        {isEditing && (
          <button
            onClick={() => handleAddItem(category)}
            className="btn btn-sm btn-outline btn-primary"
            title={`Add ${title.toLowerCase()}`}
          >
            <FaPlus className="mr-1" />
            Add
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleUpdateItem(category, index, e.target.value)}
                  className="input input-bordered input-sm flex-1"
                  placeholder={`Enter ${title.toLowerCase().slice(0, -1)}...`}
                />
                <button
                  onClick={() => handleRemoveItem(category, index)}
                  className="btn btn-sm btn-error btn-outline"
                  title="Remove item"
                >
                  <FaTrash />
                </button>
              </>
            ) : (
              <div className="flex-1 p-2 bg-base-200 rounded-lg">
                {item}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && !isEditing && (
          <div className="text-gray-500 italic p-2 bg-base-200 rounded-lg">
            No {title.toLowerCase()} found
          </div>
        )}
      </div>
    </div>
  );

  if (!profileSummary) {
    return (
      <div className="card bg-base-100 shadow-md mb-4">
        <div className="card-body">
          <h2 className="card-title text-primary">Profile Summary</h2>
          <div className="text-center text-gray-500 py-8">
            <p>No profile information available.</p>
            <p className="text-sm">Upload a resume or CV to extract profile information.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentProfile = isEditing ? editedProfile! : profileSummary;

  return (
    <div className="card bg-base-100 shadow-md mb-4">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title text-primary">Profile Summary</h2>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="btn btn-sm btn-success"
                  title="Save changes"
                >
                  <FaSave className="mr-1" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-sm btn-error"
                  title="Cancel editing"
                >
                  <FaTimes className="mr-1" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="btn btn-sm btn-primary"
                  title="Edit profile"
                >
                  <FaEdit className="mr-1" />
                  Edit
                </button>
                <button
                  onClick={onClearProfile}
                  className="btn btn-sm btn-error btn-outline"
                  title="Clear profile"
                >
                  <FaTrash className="mr-1" />
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {renderCategory('Skills', 'skills', currentProfile.skills)}
          {renderCategory('Experience', 'experience', currentProfile.experience)}
          {renderCategory('Projects', 'projects', currentProfile.projects)}
          {renderCategory('Education', 'education', currentProfile.education)}
        </div>

        {isEditing && (
          <div className="mt-4 p-3 bg-info bg-opacity-10 rounded-lg">
            <p className="text-sm text-info">
              <strong>Tip:</strong> You can add, edit, or remove items in each category. 
              Click "Save" to apply your changes or "Cancel" to discard them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSummaryCard;
