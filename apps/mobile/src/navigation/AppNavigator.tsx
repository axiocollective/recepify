import React from "react";
import { Alert, SafeAreaView, View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useApp } from "../data/AppContext";
import { colors, spacing } from "../theme/theme";
import { BottomNav } from "../components/BottomNav";
import { Home } from "../components/Home";
import { ImportInbox } from "../components/ImportInbox";
import { ImportHub } from "../components/ImportHub";
import { ImportFromLink } from "../components/ImportFromLink";
import { ImportFromWebsite } from "../components/ImportFromWebsite";
import { ImportFromTikTok } from "../components/ImportFromTikTok";
import { ImportFromPinterest } from "../components/ImportFromPinterest";
import { ScanRecipe } from "../components/ScanRecipe";
import { MyRecipes } from "../components/MyRecipes";
import { Profile } from "../components/Profile";
import { PlanBilling } from "../components/PlanBilling";
import { RecipeDetailNew } from "../components/RecipeDetailNew";
import { RecipeEdit } from "../components/RecipeEdit";
import { CookMode } from "../components/CookMode";
import { ShoppingList } from "../components/ShoppingList";
import { ImportOverlay } from "../components/ImportOverlay";
import { Welcome } from "../components/Welcome";
import { LoginScreen } from "../components/LoginScreen";
import { OnboardingWelcome } from "../components/OnboardingWelcome";
import { LoadingScreen } from "../components/LoadingScreen";
import { Logo } from "../components/Logo";
import { Search } from "../components/Search";
import {
  importFromPinterest,
  importFromScan,
  importFromTikTok,
  importFromUrl,
} from "../services/importApi";

export const AppNavigator: React.FC = () => {
  const {
    isAuthenticated,
    currentScreen,
    selectedRecipe,
    selectedTab,
    importItems,
    recipes,
    collections,
    shoppingListItems,
    userName,
    userEmail,
    userLanguage,
    userCountry,
    needsOnboarding,
    profileReady,
    aiDisabled,
    plan,
    usageSummary,
    bonusImports,
    bonusTokens,
    subscriptionPeriod,
    simulateEmptyState,
    setSimulateEmptyState,
    isImportOverlayOpen,
    setIsImportOverlayOpen,
    navigateTo,
    handleRecipeSelect,
    handleImportAction,
    toggleFavorite,
    handleAddToShoppingList,
    updateShoppingListItems,
    createCollection,
    toggleRecipeInCollection,
    deleteCollection,
    updateRecipe,
    addRecipe,
    deleteRecipe,
    updateProfile,
    deleteAccount,
    logout,
    handleLoadingComplete,
    setSelectedRecipe,
    setCurrentScreen,
    refreshUsageSummary,
    purchasePayPerUseCredits,
  } = useApp();
  const [myRecipesInitialTag, setMyRecipesInitialTag] = React.useState<string | null>(null);
  const [newlyImportedRecipeId, setNewlyImportedRecipeId] = React.useState<string | null>(null);
  const [pendingAiAction, setPendingAiAction] = React.useState<"optimize" | "translate" | null>(null);
  const [authStep, setAuthStep] = React.useState<"welcome" | "login">("welcome");
  const [onboardingActive, setOnboardingActive] = React.useState(false);
  const [onboardingStep, setOnboardingStep] = React.useState<"language" | "plan" | "loading">("language");
  const readyImportCount = importItems.filter((item) => item.status === "ready").length;

  const handleAddManualRecipe = () => {
    const blankRecipe = {
      id: `recipe-${Date.now()}`,
      title: "",
      description: "",
      category: "Main Course",
      prepTime: "",
      cookTime: "",
      totalTime: "",
      servings: 4,
      difficulty: "easy",
      ingredients: [],
      steps: [],
      source: "web",
      isFavorite: false,
      tags: [],
      notes: "",
    };
    setSelectedRecipe(blankRecipe);
    setCurrentScreen("recipeEdit");
  };

  const handleImportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    Alert.alert("Import failed", message);
  };

  const navigateToMyRecipes = (tag?: string) => {
    setMyRecipesInitialTag(tag ?? null);
    navigateTo("myRecipes");
  };

  React.useEffect(() => {
    if (!isAuthenticated) {
      setAuthStep("welcome");
      setOnboardingActive(false);
      setOnboardingStep("language");
      return;
    }
    if (profileReady && needsOnboarding) {
      setOnboardingActive(true);
    }
  }, [isAuthenticated, needsOnboarding, profileReady]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (profileReady && !needsOnboarding && !onboardingActive && currentScreen === "welcome") {
      handleLoadingComplete();
    }
  }, [currentScreen, handleLoadingComplete, isAuthenticated, needsOnboarding, onboardingActive, profileReady]);

  React.useEffect(() => {
    if (!onboardingActive || onboardingStep !== "loading") return;
    const timeout = setTimeout(() => {
      setOnboardingActive(false);
      handleLoadingComplete();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [handleLoadingComplete, onboardingActive, onboardingStep]);

  if (!isAuthenticated) {
    if (authStep === "login") {
      return (
        <LoginScreen
          onBack={() => setAuthStep("welcome")}
          onLogin={() => undefined}
        />
      );
    }
    return <Welcome onLogin={() => setAuthStep("login")} />;
  }

  if (onboardingActive) {
    if (onboardingStep === "plan") {
      return (
        <PlanBilling
          plan={plan}
          usageSummary={usageSummary}
          bonusImports={bonusImports}
          bonusTokens={bonusTokens}
          subscriptionPeriod={subscriptionPeriod}
          recipesCount={recipes.length}
          onPlanChange={(value) => updateProfile({ plan: value })}
          onBuyCredits={purchasePayPerUseCredits}
          onSubscriptionPeriodChange={(value) => updateProfile({ subscriptionPeriod: value })}
          onBack={() => setOnboardingStep("language")}
          onContinue={() => setOnboardingStep("loading")}
          continueLabel="Continue"
          title="Choose your plan"
          allowPlanSwitchOverride
          variant="onboarding"
        />
      );
    }
    if (onboardingStep === "loading") {
      return <LoadingScreen />;
    }
    return <OnboardingWelcome onContinue={() => setOnboardingStep("plan")} />;
  }

  if (currentScreen === "welcome") {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.topSafe}>
        <StatusBar style="light" />
        <View style={styles.topBar}>
          <Logo size="lg" variant="white" />
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        {currentScreen === "home" && (
          <Home
            onNavigate={navigateTo}
            onQuickTagSelect={(tag) => navigateToMyRecipes(tag)}
            onAddManually={handleAddManualRecipe}
            importQueueCount={importItems.filter((item) => item.status === "processing" || item.status === "needsConnection").length}
            recentRecipes={recipes.slice(0, 3)}
            onRecipeSelect={handleRecipeSelect}
            allRecipes={recipes}
            inboxCount={importItems.length}
            userName={userName}
            aiDisabled={aiDisabled}
            simulateEmptyState={simulateEmptyState}
            importReadyCount={readyImportCount}
            collections={collections}
          />
        )}
        {currentScreen === "importInbox" && (
          <ImportInbox items={importItems} onBack={() => navigateTo("home")} onAction={handleImportAction} />
        )}
        {currentScreen === "import" && (
          <ImportHub
            onNavigate={navigateTo}
            sharedRecipesCount={importItems.length}
            onAddManually={handleAddManualRecipe}
          />
        )}
        {currentScreen === "importFromLink" && (
          <ImportFromLink
            onBack={() => navigateTo("import")}
            onImport={async (url) => {
              try {
                const imported = await importFromUrl(url);
                const saved = await addRecipe(imported);
                const nextRecipe = saved ?? imported;
                setSelectedRecipe(nextRecipe);
                refreshUsageSummary();
                setNewlyImportedRecipeId(nextRecipe.id);
                navigateTo("recipeDetail");
              } catch (error) {
                handleImportError(error);
              }
            }}
          />
        )}
        {currentScreen === "importFromWebsite" && <ImportFromWebsite onBack={() => navigateTo("import")} />}
        {currentScreen === "importFromTikTok" && (
          <ImportFromTikTok
            onBack={() => navigateTo("import")}
            onImport={async (url) => {
              try {
                const imported = await importFromTikTok(url);
                const saved = await addRecipe(imported);
                const nextRecipe = saved ?? imported;
                setSelectedRecipe(nextRecipe);
                refreshUsageSummary();
                setNewlyImportedRecipeId(nextRecipe.id);
                navigateTo("recipeDetail");
              } catch (error) {
                handleImportError(error);
              }
            }}
          />
        )}
        {currentScreen === "importFromPinterest" && (
          <ImportFromPinterest
            onBack={() => navigateTo("import")}
            onImport={async (url) => {
              try {
                const imported = await importFromPinterest(url);
                const saved = await addRecipe(imported);
                const nextRecipe = saved ?? imported;
                setSelectedRecipe(nextRecipe);
                refreshUsageSummary();
                setNewlyImportedRecipeId(nextRecipe.id);
                navigateTo("recipeDetail");
              } catch (error) {
                handleImportError(error);
              }
            }}
          />
        )}
        {currentScreen === "scanRecipe" && (
          <ScanRecipe
            onBack={() => navigateTo("import")}
            onScan={async (imageData) => {
              try {
                const imported = await importFromScan(imageData);
                const saved = await addRecipe(imported);
                const nextRecipe = saved ?? imported;
                setSelectedRecipe(nextRecipe);
                refreshUsageSummary();
                setNewlyImportedRecipeId(nextRecipe.id);
                navigateTo("recipeDetail");
              } catch (error) {
                handleImportError(error);
              }
            }}
          />
        )}
        {currentScreen === "myRecipes" && (
          <MyRecipes
            recipes={recipes}
            onRecipeSelect={handleRecipeSelect}
            onRecipeEdit={(recipe) => {
              setSelectedRecipe(recipe);
              setCurrentScreen("recipeEdit");
            }}
            onRecipeDelete={(recipe) => deleteRecipe(recipe.id)}
            onRecipeToggleFavorite={(recipe) => toggleFavorite(recipe.id)}
            onNavigate={navigateTo}
            onAddManually={handleAddManualRecipe}
            inboxCount={importItems.length}
            importReadyCount={readyImportCount}
            initialTag={myRecipesInitialTag}
            onClearInitialTag={() => setMyRecipesInitialTag(null)}
            collections={collections}
            onCreateCollection={createCollection}
            onDeleteCollection={deleteCollection}
            onAddToCollection={toggleRecipeInCollection}
          />
        )}
        {currentScreen === "profile" && (
          <Profile
            name={userName}
            email={userEmail}
            language={userLanguage}
            country={userCountry}
            onNameChange={(value) => updateProfile({ name: value })}
            onEmailChange={(value) => updateProfile({ email: value })}
            onLanguageChange={(value) => updateProfile({ language: value })}
            onCountryChange={(value) => updateProfile({ country: value })}
            onLogout={logout}
            onDeleteAccount={deleteAccount}
            onOpenPlans={() => navigateTo("planBilling")}
          />
        )}
        {currentScreen === "planBilling" && (
          <PlanBilling
            plan={plan}
            usageSummary={usageSummary}
            bonusImports={bonusImports}
            bonusTokens={bonusTokens}
            subscriptionPeriod={subscriptionPeriod}
            recipesCount={recipes.length}
            onPlanChange={(value) => updateProfile({ plan: value })}
            onBuyCredits={purchasePayPerUseCredits}
            onSubscriptionPeriodChange={(value) => updateProfile({ subscriptionPeriod: value })}
            onBack={() => navigateTo("profile")}
          />
        )}
        {currentScreen === "recipeDetail" && selectedRecipe && (
          <RecipeDetailNew
            recipe={selectedRecipe}
            onBack={() => navigateToMyRecipes()}
            onStartCooking={() => setCurrentScreen("cookMode")}
            onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
            onEdit={() => {
              if (newlyImportedRecipeId === selectedRecipe.id) {
                setNewlyImportedRecipeId(null);
              }
              setCurrentScreen("recipeEdit");
            }}
            onAddToShoppingList={handleAddToShoppingList}
            aiDisabled={aiDisabled}
            onUpdateViewSettings={({ servings, unitSystem }) =>
              setSelectedRecipe({ ...selectedRecipe, servingsOverride: servings, unitSystem })
            }
            onDelete={() => {
              deleteRecipe(selectedRecipe.id);
              navigateToMyRecipes();
            }}
            onApproveImport={() => {
              const updated = { ...selectedRecipe, isImported: true, isImportApproved: true };
              const exists = recipes.find((recipe) => recipe.id === updated.id);
              if (exists) {
                updateRecipe(updated);
              } else {
                addRecipe(updated);
              }
              setSelectedRecipe(updated);
              setNewlyImportedRecipeId(null);
            }}
            onOptimizeWithAI={() => {
              setNewlyImportedRecipeId(null);
              setPendingAiAction("optimize");
              setCurrentScreen("recipeEdit");
            }}
            isNewImport={newlyImportedRecipeId === selectedRecipe.id}
            collections={collections}
            onAddToCollection={toggleRecipeInCollection}
            onCreateCollection={createCollection}
          />
        )}
        {currentScreen === "recipeEdit" && selectedRecipe && (
          <RecipeEdit
            recipe={selectedRecipe}
            onBack={() => {
              if (selectedRecipe.id.startsWith("recipe-")) {
                navigateTo("import");
              } else {
                navigateTo("recipeDetail");
              }
            }}
            onSave={(updatedRecipe) => {
              const exists = recipes.find((recipe) => recipe.id === updatedRecipe.id);
              if (exists) {
                updateRecipe(updatedRecipe);
              } else {
                addRecipe(updatedRecipe);
              }
              setCurrentScreen("recipeDetail");
            }}
            onApproveImport={(updatedRecipe) => {
              const exists = recipes.find((recipe) => recipe.id === updatedRecipe.id);
              if (exists) {
                updateRecipe(updatedRecipe);
              } else {
                setSelectedRecipe(updatedRecipe);
              }
            }}
            isNewRecipe={!recipes.some((recipe) => recipe.id === selectedRecipe.id)}
            aiDisabled={aiDisabled}
            initialAiAction={pendingAiAction}
            onAiActionHandled={() => setPendingAiAction(null)}
          />
        )}
        {currentScreen === "cookMode" && selectedRecipe && (
          <CookMode recipe={selectedRecipe} onExit={() => setCurrentScreen("recipeDetail")} />
        )}
        {currentScreen === "shoppingList" && (
          <ShoppingList onBack={() => navigateTo("home")} items={shoppingListItems} onUpdateItems={updateShoppingListItems} />
        )}
        {currentScreen === "search" && <Search recipes={recipes} onRecipeSelect={handleRecipeSelect} />}
      </View>
      <SafeAreaView style={styles.bottomSafe} edges={["bottom"]}>
        <BottomNav
          selected={selectedTab}
          onSelect={(tab) => {
            if (tab === "import") {
              setIsImportOverlayOpen(true);
            } else {
              if (tab === "myRecipes") {
                setMyRecipesInitialTag(null);
              }
              navigateTo(tab);
            }
          }}
          importBadgeCount={importItems.length}
        />
      </SafeAreaView>
      <ImportOverlay
        isOpen={isImportOverlayOpen}
        onClose={() => setIsImportOverlayOpen(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onAddManually={handleAddManualRecipe}
        inboxCount={importItems.length}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topSafe: {
    backgroundColor: colors.gray900,
  },
  bottomSafe: {
    backgroundColor: colors.white,
  },
  topBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray800,
    backgroundColor: colors.gray900,
  },
  content: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
