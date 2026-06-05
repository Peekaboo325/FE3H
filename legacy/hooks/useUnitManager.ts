
// [Fix] Added missing React import to resolve namespace errors for ChangeEvent and MouseEvent
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CharacterProfile } from '../types/index';
import { processCharacterImage, dataUrlToBlob } from '../utils/imageUtils'; 
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { assetManager } from '../services/system/assetManager';

export const useUnitManager = (isOpen: boolean) => {
  // [Phase 2-M.1] Atomic Selectors to prevent re-render loop
  const characters = useAppStore(state => state.characters);
  const editingChar = useAppStore(state => state.editingChar);
  const isEditMode = useAppStore(state => state.isEditMode);
  const anonymousAliasesInput = useAppStore(state => state.aliasesInput);
  
  const { 
      setEditingChar, setIsEditMode, setAliasesInput,
      handleSaveCharacter, handleDeleteCharacter, handleToggleCharacterActive, 
      handleUpdateCharacter, handleMoveCharacter, handleReorderCharacters, handleAnalyzeCharacter,
      setAnalyzingCharId
  } = useAppStore(useShallow(state => ({
      setEditingChar: state.setEditingChar,
      setIsEditMode: state.setIsEditMode,
      setAliasesInput: state.setAliasesInput,
      handleSaveCharacter: state.handleSaveCharacter,
      handleDeleteCharacter: state.handleDeleteCharacter,
      handleToggleCharacterActive: state.handleToggleCharacterActive,
      handleUpdateCharacter: state.handleUpdateCharacter,
      handleMoveCharacter: state.handleMoveCharacter,
      handleReorderCharacters: state.handleReorderCharacters,
      handleAnalyzeCharacter: state.handleAnalyzeCharacter,
      setAnalyzingCharId: state.setAnalyzingCharId
  })));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDatepicker, setShowDatepicker] = useState(false);

  // [Phase 2-M.1] Robust Session Lifecycle
  // 모달이 닫힐 때(Unmount)의 청소와 열릴 때의 초기화 보장
  useEffect(() => {
      if (isOpen) {
          setShowDatepicker(false);
      }
      
      // Cleanup on Unmount: 모달 컴포넌트 자체가 소멸할 때 편집 중이던 상태를 정리
      return () => {
          setEditingChar(null);
          setIsEditMode(false);
          setAliasesInput("");
      };
  }, [isOpen, setEditingChar, setIsEditMode, setAliasesInput]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingChar) {
      try {
        const dataUrl = await processCharacterImage(file);
        const blob = await dataUrlToBlob(dataUrl);
        const objectUrl = assetManager.createManagedUrl(blob);
        setEditingChar({ ...editingChar, thumbnail: objectUrl });
      } catch (err) {
        console.error("Image upload failed", err);
      }
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingChar) {
          setEditingChar({ ...editingChar, thumbnail: undefined });
      }
  };

  const handleCancelEdit = () => {
      setIsEditMode(false);
      if (editingChar) {
          if (editingChar.id) {
              const original = characters.find(c => c.id === editingChar.id);
              if (original) setEditingChar(original);
          } else {
              setEditingChar(null);
          }
      }
  };

  const handleCreateNew = () => {
    setEditingChar({
      id: '',
      name: '',
      english_name: '',
      description: '',
      aliases: [],
      life_status: 'alive',
      isActive: true
    });
    setAliasesInput('');
    setIsEditMode(true);
  };

  const handleSelectChar = (char: CharacterProfile) => {
    setEditingChar(char);
    setAliasesInput(char.aliases ? char.aliases.join(', ') : '');
    setIsEditMode(false);
  };

  const displayQuote = editingChar?.signature_quote || editingChar?.analysis?.generated_quote;
  const isAutoQuote = !editingChar?.signature_quote && !!editingChar?.analysis?.generated_quote;

  return {
    characters,
    editingChar,
    isEditMode,
    aliasesInput: anonymousAliasesInput,
    fileInputRef,
    showDatepicker,
    setShowDatepicker,
    handleImageUpload,
    handleRemoveImage,
    handleCancelEdit,
    handleCreateNew,
    handleSelectChar,
    displayQuote,
    isAutoQuote,
    handleSaveCharacter,
    handleDeleteCharacter,
    handleToggleCharacterActive,
    handleMoveCharacter,
    handleReorderCharacters,
    handleAnalyzeCharacter,
    // [Fix] Added missing handleUpdateCharacter to the return object
    handleUpdateCharacter,
    setAnalyzingCharId,
    setEditingChar,
    setIsEditMode,
    setAliasesInput
  };
};
