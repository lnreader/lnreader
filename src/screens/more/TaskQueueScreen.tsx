import { useEffect, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import {
  FAB,
  ProgressBar,
  Appbar as MaterialAppbar,
  overlay,
} from 'react-native-paper';

import { useTheme } from '@hooks/persisted';

import { showToast } from '../../utils/showToast';
import { getString } from '@i18n/translations';
import {
  Appbar,
  ConfirmationDialog,
  EmptyView,
  IconButtonV2,
  Menu,
  SafeAreaView,
} from '@components';
import { TaskQueueScreenProps } from '@navigators/types';
import {
  backgroundTasks,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackgroundTaskQueue } from '@hooks/persisted/useBackgroundTasks';

const DownloadQueue = ({ navigation }: TaskQueueScreenProps) => {
  const theme = useTheme();
  const { bottom, right } = useSafeAreaInsets();
  const taskQueue = useBackgroundTaskQueue();
  const [isRunning, setIsRunning] = useState(backgroundTasks.isRunning);
  const [visible, setVisible] = useState(false);
  const [taskToCancel, setTaskToCancel] = useState<QueuedBackgroundTask>();
  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);
  useEffect(() => {
    if (taskQueue?.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRunning(false);
    }
  }, [taskQueue]);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={'Task Queue'}
        handleGoBack={navigation.goBack}
        theme={theme}
      >
        <Menu
          visible={visible}
          onDismiss={closeMenu}
          anchor={
            taskQueue?.length ? (
              <MaterialAppbar.Action
                icon="dots-vertical"
                iconColor={theme.onSurface}
                onPress={openMenu}
              />
            ) : null
          }
          contentStyle={{ backgroundColor: overlay(2, theme.surface) }}
        >
          <Menu.Item
            onPress={() => {
              backgroundTasks.cancelAll();
              setIsRunning(false);
              showToast(getString('downloadScreen.cancelled'));
              closeMenu();
            }}
            title={getString('downloadScreen.cancelDownloads')}
            titleStyle={{ color: theme.onSurface }}
          />
        </Menu>
      </Appbar>

      <FlatList
        contentContainerStyle={styles.paddingBottom}
        keyExtractor={item => item.id}
        data={taskQueue || []}
        renderItem={({ item }) => (
          <View style={styles.padding}>
            <View style={styles.taskRow}>
              <View style={styles.taskDetails}>
                <Text style={{ color: theme.onSurface }}>{item.meta.name}</Text>
                {item.meta.progressText ? (
                  <Text style={{ color: theme.onSurfaceVariant }}>
                    {item.meta.progressText}
                  </Text>
                ) : null}
                <ProgressBar
                  indeterminate={
                    item.meta.isRunning && item.meta.progress === undefined
                  }
                  progress={item.meta.progress}
                  color={theme.primary}
                  style={[
                    { backgroundColor: theme.surface2 },
                    styles.marginTop,
                  ]}
                />
              </View>
              <IconButtonV2
                accessibilityLabel={`${getString('common.cancel')} ${
                  item.meta.name
                }`}
                name="close"
                onPress={() => setTaskToCancel(item)}
                theme={theme}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyView
            icon="(･o･;)"
            description={'No running tasks'}
            theme={theme}
          />
        }
      />
      {taskQueue && taskQueue.length > 0 ? (
        <FAB
          style={[
            styles.fab,
            { backgroundColor: theme.primary, bottom, right },
          ]}
          color={theme.onPrimary}
          label={
            isRunning ? getString('common.pause') : getString('common.resume')
          }
          uppercase={false}
          icon={isRunning ? 'pause' : 'play'}
          onPress={() => {
            if (isRunning) {
              backgroundTasks.pauseAll();
              setIsRunning(false);
            } else {
              backgroundTasks.resumeAll();
              setIsRunning(true);
            }
          }}
        />
      ) : null}
      <ConfirmationDialog
        title={getString('taskQueue.cancelTaskTitle')}
        message={getString('taskQueue.cancelTaskConfirmation', {
          task: taskToCancel?.meta.name ?? '',
        })}
        visible={taskToCancel !== undefined}
        confirmLabel={getString('taskQueue.cancelTaskAction')}
        cancelLabel={getString('taskQueue.keepTaskAction')}
        onDismiss={() => setTaskToCancel(undefined)}
        onConfirm={() =>
          taskToCancel ? backgroundTasks.cancel(taskToCancel.id) : undefined
        }
      />
    </SafeAreaView>
  );
};

export default DownloadQueue;

const styles = StyleSheet.create({
  fab: {
    bottom: 16,
    margin: 16,
    position: 'absolute',
    right: 0,
  },
  marginTop: { marginTop: 8 },
  paddingBottom: { paddingBottom: 100, flexGrow: 1 },
  padding: { padding: 16 },
  taskDetails: { flex: 1 },
  taskRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
