import { useEffect, useState } from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useTheme } from '@hooks/persisted';

import { showToast } from '../../utils/showToast';
import { getString } from '@i18n/translations';
import {
  Appbar,
  AppText,
  ComposeList,
  ConfirmationDialog,
  EmptyView,
  Fab,
  IconButtonV2,
  Menu,
  ProgressIndicator,
  Screen,
} from '@components';
import { TaskQueueScreenProps } from '@navigators/types';
import {
  BACKGROUND_TASKS_STORE_KEY,
  backgroundTasks,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMMKVObject } from 'react-native-mmkv';
import CloseIcon from '@expo/material-symbols/close.xml';
import MoreVertIcon from '@expo/material-symbols/more_vert.xml';
import PauseIcon from '@expo/material-symbols/pause.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';

const DownloadQueue = ({ navigation }: TaskQueueScreenProps) => {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [taskQueue] = useMMKVObject<QueuedBackgroundTask[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
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
    <Screen
      topBar={
        <Appbar
          title={'Task Queue'}
          handleGoBack={navigation.goBack}
          theme={theme}
        >
          {taskQueue?.length ? (
            <Menu
              visible={visible}
              onDismiss={closeMenu}
              anchor={
                <IconButtonV2
                  name={MoreVertIcon}
                  color={theme.onSurface}
                  onPress={openMenu}
                  theme={theme}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  backgroundTasks.cancelAll();
                  setIsRunning(false);
                  showToast(getString('downloadScreen.cancelled'));
                  closeMenu();
                }}
                title={getString('downloadScreen.cancelDownloads')}
              />
            </Menu>
          ) : null}
        </Appbar>
      }
      list={
        <ComposeList
          contentPadding={{ bottom: bottom + 100 }}
          keyExtractor={item => item.id}
          data={taskQueue || []}
          renderItem={item => (
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
            >
              <Column modifiers={[weight(1)]}>
                <AppText color={theme.onSurface}>{item.meta.name}</AppText>
                {item.meta.progressText ? (
                  <AppText color={theme.onSurfaceVariant}>
                    {item.meta.progressText}
                  </AppText>
                ) : null}
                <ProgressIndicator
                  progress={
                    item.meta.isRunning && item.meta.progress === undefined
                      ? undefined
                      : item.meta.progress ?? 0
                  }
                  modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}
                />
              </Column>
              <IconButtonV2
                accessibilityLabel={`${getString('common.cancel')} ${
                  item.meta.name
                }`}
                name={CloseIcon}
                onPress={() => setTaskToCancel(item)}
                theme={theme}
              />
            </Row>
          )}
          footer={
            taskQueue?.length ? null : (
              <EmptyView
                icon="(･o･;)"
                description={'No running tasks'}
                theme={theme}
              />
            )
          }
        />
      }
      floatingAction={
        taskQueue && taskQueue.length > 0 ? (
          <Fab
            extended
            label={
              isRunning ? getString('common.pause') : getString('common.resume')
            }
            icon={isRunning ? PauseIcon : PlayArrowIcon}
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
        ) : null
      }
      overlays={
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
      }
    />
  );
};

export default DownloadQueue;
