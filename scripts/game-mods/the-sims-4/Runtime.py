#    Copyright 2020 June Hanabi
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

import random
import zone
import sims4.commands

from functools import wraps
import sims4.log
import select
import socket
import json
import routing
import os
import services
import placement
from automation.constants import Constants
from clock import ClockSpeedMode
from sims.household_enums import HouseholdChangeOrigin
from server_commands.argument_helpers import get_tunable_instance
from protocolbuffers import Consts_pb2
from interactions.context import InteractionContext
from interactions.priority import Priority
from interactions.constraints import Constraint
from services.fire_service import FireImmunityLiability
from sims.sim_info_types import Age, Gender
from sims.sim_spawner import SimSpawner, SimCreator
from sims.pregnancy.pregnancy_enums import PregnancyOrigin
from sims4.math import MAX_UINT32, EPSILON
from sims4.localization import LocalizationHelperTuning
from ui.ui_dialog_notification import UiDialogNotification
from distributor.shared_messages import IconInfoData
from sims4.resources import get_resource_key, Types, get_debug_name
from sims.sim_info_base_wrapper import SimInfoBaseWrapper
from sims.outfits.outfit_enums import OutfitCategory, OutfitFilterFlag, BodyTypeFlag
from relationships.global_relationship_tuning import RelationshipGlobalTuning
from relationships.relationship_tracker import RelationshipTracker
from relationships.relationship_track import RelationshipTrack
from camera import focus_on_sim, focus_on_object, shake_camera, focus_on_object_from_position, focus_on_lot, walls_up_override, focus_on_position
from simulate_to_time import SimulateToTime
from interactions.utils.object_definition_or_tags import ObjectDefinitionsFilter
from server_commands.sim_filter_commands import create_sim_info_from_template
from server_commands.object_commands import make_broken, make_fixed, make_clean, make_dirty
from sims.sim_info_types import SpeciesExtended
from routing.walkstyle.walkstyle_behavior import WalksStyleBehavior
from teleport.teleport_helper import TeleportHelper
from objects.object_enums import ItemLocation, PersistenceType, ResetReason
import sims4.math
import terrain

HOST = "127.0.0.1"  # Standard loopback interface address (localhost)
PORT = 58814

logger = sims4.log.Logger('ShenPulse', default_owner='dtothefourth')


client = None
read_list = []
dialogs = []
recv_buffer = b""
retry = 0
notify = False
toast = True
_response_sent = False

@sims4.commands.Command('shenpulse_connect', command_type=sims4.commands.CommandType.Live)
def _hellow(_connection=None):
    global client
    global read_list
    global dialogs
    global recv_buffer
    try:
        if client != None:
            client.close()
        read_list.clear()
        recv_buffer = b""
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.setblocking(False)
        client.connect_ex((HOST, PORT))
        read_list.append(client)
    except:
        if client != None:
            client.close()
        read_list.clear()
        recv_buffer = b""
        client = None

@sims4.commands.Command('shenpulse_messages', command_type=sims4.commands.CommandType.Live)
def _hellow(_connection=None):
    global toast
    output = sims4.commands.CheatOutput(_connection)
    if toast:
        toast = False
        output('ShenPulse Messages Off')
    else:
        toast = True
        output('ShenPulse Messages On')

# method calling injection
def inject(target_function, new_function):
    @wraps(target_function)
    def _inject(*args, **kwargs):
        return new_function(target_function, *args, **kwargs)

    return _inject


# decarator injection.
def inject_to(target_object, target_function_name):
    def _inject_to(new_function):
        target_function = getattr(target_object, target_function_name)
        setattr(target_object, target_function_name, inject(target_function, new_function))
        return new_function

    return _inject_to

@inject_to(zone.Zone, 'on_client_connect')
def inject_zone_update(original, self, clientb):
    global notify
    original(self, clientb)
    if not notify:
        notify = True
        show_notification("Les interactions ShenPulse sont chargées.", "ShenPulse")


def _process_effect(s, values, current_zone):
    code = str(values.get('code', ''))
    id = values.get('id', 0)
    user = str(values.get('viewer') or 'Viewer')
    params = values.get('parameters') or []
    if isinstance(params, dict):
        params = [params.get('age', 'young'), params.get('gender', 'male'), params.get('pronouns', 'hehim')]
    if code == 'addviewer':
        params = (list(params) + ['young', 'male', 'hehim'])[:3]
    self = current_zone
    for _dispatch_once in (0,):
        game_clock = services.game_clock_service()
        active_household = services.active_household()
        current_sim = services.active_sim_info()
        active_sim = services.get_active_sim()
        active_lot = services.active_lot()
        sim_info_manager = services.sim_info_manager()

        parts = code.split('_')

        #show_notification(str(code), "Effect Code")
        #show_notification(str(params), "Effect Params")

        if self.is_in_build_buy == True:
            respondRetry(s, id)
            break

        if code == "teleport":



            override_teleport = active_sim.get_walkstyle() in WalksStyleBehavior.WALKSTYLES_OVERRIDE_TELEPORT
            routing_slave_prevents_teleport = TeleportHelper.does_routing_slave_prevent_teleport(active_sim)
            if not override_teleport or routing_slave_prevents_teleport:

                active_lot = services.active_lot()
                final_position = active_lot.get_random_point()

                level = active_sim.routing_surface.secondary_id
                is_in_water = active_sim.should_be_swimming_at_position(final_position, level)
                if not is_in_water:

                    fgl_search_flags = placement.FGLSearchFlagsDefault | placement.FGLSearchFlag.USE_SIM_FOOTPRINT | placement.FGLSearchFlag.STAY_IN_CURRENT_BLOCK

                    additional_avoid_sim_radius = routing.get_sim_extra_clearance_distance()
                    starting_location = placement.create_starting_location(position=final_position)
                    fgl_context = placement.create_fgl_context_for_sim(starting_location, self,
                                                                       search_flags=fgl_search_flags,
                                                                       additional_avoid_sim_radius=additional_avoid_sim_radius)
                    final_position, orient = placement.find_good_location(fgl_context)


                    new_location = active_sim.location.clone(translation=final_position)

                    if not active_sim.validate_location(new_location):
                        respondRetry(s, id)

                    active_sim.on_reset_internal_state(ResetReason.NONE)
                    active_sim.location = new_location
                    active_sim.fade_in()

                    show_notification(user + " teleported " + current_sim.full_name + "!",
                                      "Teleportation")
                    respondSuccess(s, id)
                    break
            respondRetry(s, id)
            break

        if parts[0] == "break":
            if not check_home_lot(self, active_sim):
                respondRetry(s, id)
                break

            objects = services.object_manager().valid_objects()

            tags = get_tag(parts[1])

            if len(objects)==0:
                respondRetry(s, id)
                break

            found = False

            for obj in objects:
                if obj.is_on_active_lot():
                    for tag in obj.definition.build_buy_tags:
                        val = int(str(tag).strip())
                        if val in tags:
                            make_broken(obj.id)
                            found = True

            if not found:
                respondRetry(s, id)
                break

            show_notification(user + " broke the " + parts[1] + "s!", "Spontaneous Breakage")
            respondSuccess(s, id)
            break

        if parts[0] == "fix":
            if not check_home_lot(self, active_sim):
                respondRetry(s, id)
                break

            objects = services.object_manager().valid_objects()

            if len(objects)==0:
                respondRetry(s, id)
                break

            tags = get_tag(parts[1])

            found = False

            for obj in objects:
                if obj.is_on_active_lot():
                    for tag in obj.definition.build_buy_tags:
                        val = int(str(tag).strip())
                        if val in tags:
                            make_fixed(obj.id)
                            found = True

            if not found:
                respondRetry(s, id)
                break

            show_notification(user + " fixed the " + parts[1] + "s!", "Spontaneous Breakage")
            respondSuccess(s, id)
            break

        if parts[0] == "dirty":
            if not check_home_lot(self, active_sim):
                respondRetry(s, id)
                break

            objects = services.object_manager().valid_objects()

            if len(objects)==0:
                respondRetry(s, id)
                break

            tags = get_tag(parts[1])

            found = False

            for obj in objects:
                if obj.is_on_active_lot():
                    for tag in obj.definition.build_buy_tags:
                        val = int(str(tag).strip())
                        if val in tags:
                            make_dirty(obj.id)
                            found = True

            if not found:
                respondRetry(s, id)
                break

            show_notification(user + " dirtied the " + parts[1] + "s!", "Spontaneous Dirt")
            respondSuccess(s, id)
            break

        if parts[0] == "clean":
            if not check_home_lot(self, active_sim):
                respondRetry(s, id)
                break

            objects = services.object_manager().valid_objects()

            if len(objects)==0:
                respondRetry(s, id)
                break

            tags = get_tag(parts[1])

            found = False

            for obj in objects:
                if obj.is_on_active_lot():
                    for tag in obj.definition.build_buy_tags:
                        val = int(str(tag).strip())
                        if val in tags:
                            make_clean(obj.id)
                            found = True

            if not found:
                respondRetry(s, id)
                break

            show_notification(user + " cleaned the " + parts[1] + "s!", "Spontaneous Cleaning")
            respondSuccess(s, id)
            break

        if code == "warp":
            if SimulateToTime()._alarm_handle != None:
                respondRetry(s, id)
                break

            SimulateToTime().start(0, 0, 1, ClockSpeedMode.SUPER_SPEED3)
            show_notification(user + " forced time to fly!", "Fast Forward")
            respondSuccess(s, id)
            break

        if code == "shake":
            shake_camera(10)
            respondSuccess(s, id)
            show_notification(user + " shook the camera!", "Shaky")
            break

        if code == "resetrel":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            if len(relationships)==0:
                respondRetry(s, id)
                break

            rel_tracker.destroy_all_relationships()
            respondSuccess(s, id)
            show_notification(user + " reset  " + current_sim.full_name + "'s relationships!", "Relationships")
            break

        if code == "marry":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships)==0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT):
                    respondRetry(s, id)
                    break
                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT):
                    respondRetry(s, id)
                    break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.ROMANCE_TRACK):
                    relationship = rel
                    break

            if relationship is None:
                for rel in relationships:
                    other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                    if services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK):
                        relationship = rel
                        break

            if relationship is None:
                relationship = random.choice(relationships)

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)

            rel_tracker.set_track_to_max(other_sim_id, RelationshipGlobalTuning.REL_INSPECTOR_TRACK)

            services.relationship_service().get_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK, True)
            rel_tracker.set_track_to_max(other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK)

            services.relationship_service().get_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.ROMANCE_TRACK, True)
            rel_tracker.set_track_to_max(other_sim_id, RelationshipTrack.ROMANCE_TRACK)

            rel_tracker.add_relationship_bit(other_sim_id, RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT, force_add=True)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " get engaged!", "Relationships")
            break

        if code == "divorce":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships)==0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT):
                    relationship = rel
                    break
                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT):
                    relationship = rel
                    break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)


            services.relationship_service().get_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.ROMANCE_TRACK, True)
            rel_tracker.set_relationship_score(other_sim_id, 50, RelationshipTrack.ROMANCE_TRACK)

            rel_tracker.remove_relationship_bit(other_sim_id, RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT)
            rel_tracker.remove_relationship_bit(other_sim_id, RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " get divorced!", "Relationships")
            break

        if code == "addromance":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships) == 0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if not services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.ROMANCE_TRACK):
                    relationship = rel
                    break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)

            rel_tracker.set_track_to_max(other_sim_id, RelationshipGlobalTuning.REL_INSPECTOR_TRACK)


            services.relationship_service().get_relationship_track(current_sim.sim_id, other_sim_id,
                                                                   RelationshipTrack.ROMANCE_TRACK, True)
            rel_tracker.set_relationship_score(other_sim_id, 20, RelationshipTrack.ROMANCE_TRACK)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " find romance!", "Relationships")
            break

        if code == "subromance":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships)==0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT):
                    continue
                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT):
                    continue

                if not services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id,
                                                                                  RelationshipTrack.ROMANCE_TRACK):
                    continue

                relationship = rel
                break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)


            services.relationship_service().remove_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.ROMANCE_TRACK)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " lose romance!", "Relationships")
            break

        if code == "addfriend":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships) == 0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if not services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK):
                    relationship = rel
                    break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)

            rel_tracker.set_track_to_max(other_sim_id, RelationshipGlobalTuning.REL_INSPECTOR_TRACK)


            services.relationship_service().get_relationship_track(current_sim.sim_id, other_sim_id,
                                                                   RelationshipTrack.FRIENDSHIP_TRACK, True)
            rel_tracker.set_relationship_score(other_sim_id, 20, RelationshipTrack.FRIENDSHIP_TRACK)

            respondSuccess(s, id)
            show_notification(user + " gave  " + current_sim.full_name + " a new friend!", "Relationships")
            break

        if code == "subfriend":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships)==0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT):
                    continue
                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT):
                    continue

                if services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id,
                                                                                  RelationshipTrack.ROMANCE_TRACK):
                    continue

                if not services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id,
                                                                                  RelationshipTrack.FRIENDSHIP_TRACK):
                    continue

                if rel_tracker.get_relationship_score(other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK) <= 0:
                    continue


                relationship = rel
                break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)

            rel_tracker.set_relationship_score(other_sim_id, 0, RelationshipGlobalTuning.REL_INSPECTOR_TRACK)
            rel_tracker.set_relationship_score(other_sim_id, 0, RelationshipTrack.FRIENDSHIP_TRACK)
            services.relationship_service().remove_relationship_track(current_sim.sim_id, other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " lose a friend!", "Relationships")
            break

        if code == "addenemy":
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            rel_tracker = current_sim.relationship_tracker

            relationships = services.relationship_service()._get_relationships_for_sim(current_sim.sim_id)

            relationship = None

            if len(relationships)==0:
                respondRetry(s, id)
                break

            for rel in relationships:
                other_sim_id = rel.get_other_sim_id(current_sim.sim_id)

                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.MARRIAGE_RELATIONSHIP_BIT):
                    continue
                if rel_tracker.has_bit(other_sim_id,RelationshipGlobalTuning.ENGAGEMENT_RELATIONSHIP_BIT):
                    continue

                if services.relationship_service().has_relationship_track(current_sim.sim_id, other_sim_id,
                                                                                  RelationshipTrack.ROMANCE_TRACK):
                    continue

                if rel_tracker.get_relationship_score(other_sim_id, RelationshipTrack.FRIENDSHIP_TRACK) < -25:
                    continue
                if rel_tracker.get_relationship_score(other_sim_id, RelationshipGlobalTuning.REL_INSPECTOR_TRACK) < -25:
                    continue

                relationship = rel
                break

            if relationship is None:
                respondRetry(s, id)
                break

            other_sim_id = relationship.get_other_sim_id(current_sim.sim_id)

            rel_tracker.set_relationship_score(other_sim_id, -75, RelationshipGlobalTuning.REL_INSPECTOR_TRACK)
            rel_tracker.set_relationship_score(other_sim_id, -75, RelationshipTrack.FRIENDSHIP_TRACK)

            respondSuccess(s, id)
            show_notification(user + " made  " + current_sim.full_name + " lose a friend!", "Relationships")
            break


        if parts[0] == "addviewer":



            if not check_home_lot(self, active_sim):
                respondRetry(s, id)
                break

            age = Age.YOUNGADULT

            if params[0]=="teen":
                age = Age.TEEN
            if params[0]=="young":
                age = Age.YOUNGADULT
            if params[0]=="adult":
                age = Age.ADULT
            if params[0]=="elder":
                age = Age.ELDER

            gender = Gender.MALE

            pronouns = ""

            if params[2]=="hehim":
                if params[1] != "male":
                    pronouns = "he|him|his|his|himself"

            if params[2]=="sheher":
                if params[1] != "female":
                    pronouns = "she|her|her|hers|herself"

            if params[2] == "theythem":
                pronouns = "they|them|their|theirs|themself"

            if params[2] == "hethem":
                pronouns = "he|them|their|theirs|themself"

            if params[2] == "shethem":
                pronouns = "he|them|their|theirs|themself"

            if params[2] == "it":
                pronouns = "it|it|its|its|itself"

            if params[1]=="male":
                gender = Gender.MALE
            if params[1]=="female":
                gender = Gender.FEMALE

            first = user
            # first = "dtothefourth"

            sim_creator = SimCreator(age=age, gender=gender, first_name=first, last_name=current_sim.last_name)

            count = len(sim_info_manager.get_all())

            dev_create_sims(SimSpawner, (sim_creator,), pronouns=pronouns,household=current_sim.household,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')


            count2 = len(sim_info_manager.get_all())

            if count2 > count:

                respondSuccess(s, id)
                show_notification(user + " added themselves to your family!", "Surprise Visitor")
            else:
                respondRetry(s, id)
            break

        if code == 'mood_angry':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("27207", Types.BUFF))

            if(current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_confident':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9289", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_energized':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9331", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_focused':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9294", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_happy':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9323", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_inspired':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9300", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_playful':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9341", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_flirty':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9305", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'mood_sad':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            buff_manager = services.get_instance_manager(Types.BUFF)
            buff_test = buff_manager.get(get_resource_key("9336", Types.BUFF))

            if (current_sim.has_buff(buff_test)):
                respondRetry(s, id)
                break

            buff_old = buff_manager.get(get_resource_key("27207", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9289", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9331", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9294", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9323", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9300", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9341", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9305", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)
            buff_old = buff_manager.get(get_resource_key("9336", Types.BUFF))
            current_sim.remove_buff_by_type(buff_old)

            current_sim.debug_add_buff_by_type(buff_test)
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s mood!", "Mood Change")
            break

        if code == 'outfit_everyday':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break


            if not current_sim.has_outfit((OutfitCategory.EVERYDAY, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.EVERYDAY:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.EVERYDAY, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_work':

            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.CAREER, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.CAREER:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.CAREER, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_bathing':

            current_sim.packed_pronouns = "they|them|their|theirs|themself"

            show_notification(current_sim.packed_pronouns)
            respondSuccess(s, id)

            if not check_sim_home(active_sim):
                show_notification("Sim not home", "Bathing Error")
                respondRetry(s, id)
                break


            if not current_sim.has_outfit((OutfitCategory.BATHING, 0)):
                show_notification("Outfit not found", "Bathing Error")
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.BATHING:
                show_notification("Already current outfit", "Bathing Error")
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.BATHING, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_athletic':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.ATHLETIC, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.ATHLETIC:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.ATHLETIC, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_cold':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.COLDWEATHER, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.COLDWEATHER:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.COLDWEATHER, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_hot':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.HOTWEATHER, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.HOTWEATHER:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.HOTWEATHER, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_formal':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.FORMAL, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.FORMAL:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.FORMAL, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_party':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.PARTY, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.PARTY:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.PARTY, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_sleep':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.SLEEP, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.SLEEP:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.SLEEP, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'outfit_swimming':
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if not current_sim.has_outfit((OutfitCategory.SWIMWEAR, 0)):
                respondRetry(s, id)
                break

            current_outfit_type, current_outfit_index = current_sim.get_current_outfit()
            if current_outfit_type == OutfitCategory.SWIMWEAR:
                respondRetry(s, id)
                break

            current_sim.set_current_outfit((OutfitCategory.SWIMWEAR, 0))
            respondSuccess(s, id)
            show_notification(user + " changed  " + current_sim.full_name + "'s outfit!", "Change of Clothes")
            break

        if code == 'ptoup':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker == None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            pto = career.pto

            career.add_pto(1)

            if pto == career.pto:
                respondRetry(s, id)
                break

            career.resend_career_data()

            respondSuccess(s, id)
            show_notification(user + " gave  " + current_sim.full_name + " paid time off!", "Paid Leave")
            break

        if code == 'ptodown':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker == None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            pto = career.pto

            career.add_pto(-1)

            if pto < 1:
                respondRetry(s, id)
                break

            if pto == career.pto:
                respondRetry(s, id)
                break

            career.resend_career_data()

            respondSuccess(s, id)
            show_notification(user + " took  " + current_sim.full_name + "'s paid time off!", "Paid Leave")
            break

        if code == 'perfup':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker == None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            max = career.current_level_tuning.performance_stat.max_value

            val = career.work_performance
            if(val>max-10):
                respondRetry(s, id)
                break
            career.add_work_performance(10)

            career.resend_career_data()

            respondSuccess(s, id)
            show_notification(user + " increased  " + current_sim.full_name + "'s job performance!", "Job Boost")
            break

        if code == 'perfdown':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker == None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            min = career.current_level_tuning.performance_stat.min_value

            val = career.work_performance
            if(val<min+10):
                respondRetry(s, id)
                break
            career.add_work_performance(-10)

            career.resend_career_data()

            respondSuccess(s, id)
            show_notification(user + " decreased  " + current_sim.full_name + "'s job performance!", "Job Mishap")
            break

        if code == 'promote':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker==None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            if not career.can_change_level(demote=False):
                respondRetry(s, id)
                break

            career.promote()
            respondSuccess(s, id)
            break

        if code == 'demote':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker==None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]

            if not career.can_change_level(demote=True):
                respondRetry(s, id)
                break

            career.demote()
            respondSuccess(s, id)
            break

        if code == 'fired':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            career_tracker = current_sim._career_tracker
            if career_tracker==None:
                respondRetry(s, id)
                break
            if not career_tracker.has_career:
                respondRetry(s, id)
                break

            career = list(career_tracker._careers.values())[0]
            career.fire()

            show_notification(user + " got  " + current_sim.full_name + " fired!", "Fired")

            respondSuccess(s, id)
            break

        if code == 'ageup':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if current_sim.age == Age.ELDER:
                respondRetry(s, id)
                break

            if current_sim.age == Age.BABY:
                SimInfoBaseWrapper.apply_age(current_sim, Age.TODDLER)
            elif current_sim.age == Age.TODDLER:
                SimInfoBaseWrapper.apply_age(current_sim, Age.CHILD)
            elif current_sim.age == Age.CHILD:
                SimInfoBaseWrapper.apply_age(current_sim, Age.TEEN)
            elif current_sim.age == Age.TEEN:
                SimInfoBaseWrapper.apply_age(current_sim, Age.YOUNGADULT)
            elif current_sim.age == Age.YOUNGADULT:
                SimInfoBaseWrapper.apply_age(current_sim, Age.ADULT)
            elif current_sim.age == Age.ADULT:
                SimInfoBaseWrapper.apply_age(current_sim, Age.ELDER)

            show_notification(user + " made " + current_sim.full_name + " older!", "Rapid Aging")
            respondSuccess(s, id)
            break

        if code == 'agedown':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if current_sim.age <= Age.TEEN:
                respondRetry(s, id)
                break

            elif current_sim.age == Age.YOUNGADULT:
                SimInfoBaseWrapper.apply_age(current_sim, Age.TEEN)
            elif current_sim.age == Age.ADULT:
                SimInfoBaseWrapper.apply_age(current_sim, Age.YOUNGADULT)
            elif current_sim.age == Age.ELDER:
                SimInfoBaseWrapper.apply_age(current_sim, Age.ADULT)

            show_notification(user + " made " + current_sim.full_name + " younger!", "Reverse Aging")
            respondSuccess(s, id)
            break

        if parts[0] in [ 'comedy', 'cooking','fishing','fitness','gardening','gourmet','guitar','handiness','logic','mischief','mixology','painting','piano','photography','programming','rocketscience','videogaming','violin','writing'] and parts[1]=='up':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if not increase_skill(parts[0],current_sim):
                respondRetry(s, id)
                break
            respondSuccess(s, id)
            show_notification(user+" increased " + current_sim.full_name + "'s " + parts[0] + " skill!","Skill Up")
            break

        if parts[0] in [ 'comedy', 'cooking','fishing','fitness','gardening','gourmet','guitar','handiness','logic','mischief','mixology','painting','piano','photography','programming','rocketscience','videogaming','violin','writing'] and parts[1]=='down':
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if not decrease_skill(parts[0],current_sim):
                respondRetry(s, id)
                break
            respondSuccess(s, id)
            show_notification(user+" decreased " + current_sim.full_name + "'s " + parts[0] + " skill!","Skill Down")
            break

        if code.startswith('pregnant'):
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if current_sim.is_teen_or_younger:
                respondRetry(s, id)
                break
            pregnancy_tracker = current_sim.pregnancy_tracker
            if pregnancy_tracker is None:
                respondRetry(s, id)
                break

            if pregnancy_tracker._is_enabled:
                respondRetry(s, id)
                break

            # pregnancy_tracker.start_pregnancy(current_sim,current_sim)

            pregnancy_tracker._seed = random.randint(1, MAX_UINT32)
            pregnancy_tracker._parent_ids = (current_sim.id, current_sim.id)
            pregnancy_tracker._offspring_data = []
            pregnancy_tracker._origin = PregnancyOrigin.DEFAULT
            pregnancy_tracker.enable_pregnancy()

            if not pregnancy_tracker._is_enabled:
                respondRetry(s, id)
                break

            respondSuccess(s, id)

            show_notification(user+" made " + current_sim.full_name + " pregnant!","Unexpected Pregnancy")

            break

        if code.startswith('unpregnant'):
            if not check_sim(active_sim):
                respondRetry(s, id)
                break

            if current_sim.is_teen_or_younger:
                respondRetry(s, id)
                break
            pregnancy_tracker = current_sim.pregnancy_tracker
            if pregnancy_tracker is None:
                respondRetry(s, id)
                break

            if not pregnancy_tracker._is_enabled:
                respondRetry(s, id)
                break

            pregnancy_tracker.clear_pregnancy()

            if pregnancy_tracker._is_enabled:
                respondRetry(s, id)
                break

            respondSuccess(s, id)

            show_notification(user + " made " + current_sim.full_name + "  no longer pregnant...!", "Canceled Pregnancy")

            break

        if code.startswith('daycare'):
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            sim_creator = SimCreator(age=Age.CHILD)

            count = len(sim_info_manager.get_all())

            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')
            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')

            count2 = len(sim_info_manager.get_all())

            if count2 > count:
                respondSuccess(s, id)
                show_notification(user + " spawned a sim!", "Surprise Visitor")
            else:
                respondRetry(s, id)
            break

        if code.startswith('spawnclown'):

            sim_creator = SimCreator(age=Age.ADULT, resource_key=get_resource_key("139881", Types.SIM_TEMPLATE))

            count = len(sim_info_manager.get_all())

            template = sims4.tuning.serialization.create_class_instance(get_resource_key("139881", Types.SIM_TEMPLATE), Types.SIM_TEMPLATE)

            # SimSpawner.create_sims((sim_creator,), household=None, generate_deterministic_sim=True, sim_position=active_sim.transform.translation, creation_source='cheat: spawnsim')

            create_sim_info_from_template(template, True)

            count2 = len(sim_info_manager.get_all())

            if count2 > count:
                respondSuccess(s, id)
                show_notification(user + " spawned a sim!", "Surprise Visitor")
            else:
                respondRetry(s, id)
            break

        if code.startswith('spawnsim'):
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            sim_creator = SimCreator(age=Age.ADULT)

            count = len(sim_info_manager.get_all())

            SimSpawner.create_sims((sim_creator,), household=None,
                                   generate_deterministic_sim=True,
                                   sim_position=active_sim.transform.translation,
                                   creation_source='cheat: spawnsim')

            count2 = len(sim_info_manager.get_all())

            if count2 > count:
                respondSuccess(s, id)
                show_notification(user + " spawned a sim!", "Surprise Visitor")
            else:
                respondRetry(s, id)
            break

        if code.startswith('addmoney_'):

            val = code.split('_')[1]
            val = int(val)

            if active_household is not None:
                active_household.funds.add(val, (Consts_pb2.TELEMETRY_INTERACTION_REWARD))
                respondSuccess(s, id)
                show_notification(user + " gave you " + str(val) + " simoleans!", "Free Money")
            else:
                respondRetry(s, id)
            break

        if code == 'ignite':
            if not check_sim_busy(active_sim):
                respondRetry(s, id)
                break

            fire_service = services.get_fire_service()

            fire_position, parent_obj = Constraint.get_validated_routing_position(active_sim)
            fire_transform = active_sim.transform
            fire_transform.translation = fire_position
            fire_object = fire_service._spawn_fire(fire_transform, active_sim.routing_surface)
            if fire_object is None:
                respondRetry(s, id)
                break

            context = InteractionContext(active_sim, (InteractionContext.SOURCE_SCRIPT),
                                         (Priority.Critical),
                                         client=None,
                                         pick=None)
            result = active_sim.push_super_affordance(fire_service.FIRE_SIM_ON_FIRE_AFFORDANCE, None, context)
            if result:
                result.interaction.add_liability(FireImmunityLiability.LIABILITY_TOKEN, FireImmunityLiability())

            # fire_service.spawn_fire_at_object(active_sim)
            respondSuccess(s, id)
            show_notification(user + " started a fire!", "Spontaneous Combustion")
            break

        if code.startswith('takemoney_'):

            val = code.split('_')[1]
            val = int(val)

            if active_household is not None:
                if active_household.funds.try_remove(val, Consts_pb2.TELEMETRY_OBJECT_BUY):
                    respondSuccess(s, id)
                    show_notification(user + " took " + str(val) + " simoleans!", "Disappearing Money")
                else:
                    respondRetry(s, id)
            else:
                respondRetry(s, id)
            break

        if code.startswith('bladder_') or code.startswith('hunger_') or code.startswith('fun_') or code.startswith('social_') or code.startswith('hygiene_') or code.startswith('energy_'):
            if not check_sim_home(active_sim):
                respondRetry(s, id)
                break

            if code=="hunger_min":
                if(current_sim.is_death_disabled()):
                    respondRetry(s, id)
                    break

                # if hunger is already bottomed out, a previous kill is
                # still in progress; fail instead of killing again
                sim = current_sim.get_sim_instance()
                hunger_stat = get_tunable_instance((sims4.resources.Types.STATISTIC), 'motive_hunger', exact_match=True)
                if sim is not None and hunger_stat is not None:
                    hunger_tracker = sim.get_tracker(hunger_stat)
                    if hunger_tracker is not None and hunger_tracker.get_value(hunger_stat) <= hunger_stat.min_value + 1:
                        respondFail(s, id, 'Sim is already dying')
                        break

            val = code.split('_')[1]
            stat = code.split('_')[0]
            changeStat(stat,val,s,id)

            if code=="hunger_min":
                show_notification(user+" killed " + current_sim.full_name + "!","Death")
            else:
                show_notification(user + " changed " + current_sim.full_name + "'s needs!", "Mood Swing")

            break

        if code == 'speednormal':
            if SimulateToTime()._alarm_handle != None:
                respondRetry(s, id)
                break
            if game_clock.clock_speed == ClockSpeedMode.NORMAL:
                respondRetry(s, id)
                break

            game_clock.set_clock_speed(ClockSpeedMode.NORMAL)
            respondSuccess(s, id)
            show_notification(user+" change the game speed.","Speedy")
            break
        if code == 'speedfast':
            if SimulateToTime()._alarm_handle != None:
                respondRetry(s, id)
                break
            if game_clock.clock_speed == ClockSpeedMode.SPEED2:
                respondRetry(s, id)
                break

            game_clock.set_clock_speed(ClockSpeedMode.SPEED2)
            respondSuccess(s, id)
            show_notification(user + " change the game speed.", "Speedy")
            break
        if code == 'speedultra':
            if game_clock.clock_speed == ClockSpeedMode.SPEED3:
                respondRetry(s, id)
                break

            game_clock.set_clock_speed(ClockSpeedMode.SPEED3)
            respondSuccess(s, id)
            show_notification(user + " change the game speed.", "Speedy")
            break
        if code == 'speedpaused':
            if SimulateToTime()._alarm_handle != None:
                respondRetry(s, id)
                break
            if game_clock.clock_speed == ClockSpeedMode.PAUSED:
                respondRetry(s, id)
                break

            game_clock.set_clock_speed(ClockSpeedMode.PAUSED)
            respondSuccess(s, id)
            show_notification(user + " change the game speed.", "Speedy")
            break

    else:
        respondFail(s, id, 'Interaction inconnue ou indisponible.')


def _disconnect():
    global client, recv_buffer, retry
    if client is not None:
        try:
            client.close()
        except Exception:
            pass
    client = None
    recv_buffer = b''
    read_list.clear()
    retry = 60


@inject_to(zone.Zone, 'update')
def inject_zone_update(original, self, absolute_ticks):
    global client, recv_buffer, retry, _response_sent
    original(self, absolute_ticks)
    if not self.is_zone_running:
        return
    if client is None:
        if retry > 0:
            retry -= 1
            return
        try:
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.setblocking(False)
            client.connect_ex((HOST, PORT))
        except Exception:
            _disconnect()
            return
    try:
        readable, _, errored = select.select([client], [], [client], 0)
        if errored:
            _disconnect()
            return
        if readable:
            data = client.recv(65536)
            if not data:
                _disconnect()
                return
            recv_buffer += data
        while b'\0' in recv_buffer:
            frame, recv_buffer = recv_buffer.split(b'\0', 1)
            if not frame.strip():
                continue
            values = json.loads(frame.decode('utf-8'))
            if 'code' not in values:
                continue
            _response_sent = False
            try:
                _process_effect(client, values, self)
            except Exception as error:
                _write_error(values.get('code', ''), error)
                if not _response_sent:
                    respondFail(client, values.get('id', 0), 'Cette interaction ne peut pas être appliquée à la situation actuelle.')
    except (OSError, ValueError):
        _disconnect()


def _write_error(code, error):
    import traceback
    import tempfile
    try:
        with open(os.path.join(tempfile.gettempdir(), 'ShenPulseSims4.log'), 'a', encoding='utf8') as log:
            log.write('\n' + code + ': ' + str(error) + '\n' + traceback.format_exc())
    except Exception:
        pass


def _respond(s, id, status, message=''):
    global _response_sent
    s.sendall((json.dumps({'id': id, 'status': status, 'message': message}, ensure_ascii=False) + '\0').encode('utf8'))
    _response_sent = True


def respondSuccess(s, id):
    _respond(s, id, 0)


def respondRetry(s, id, msg=''):
    _respond(s, id, 3, msg or 'Les conditions de cette interaction ne sont pas réunies dans la partie actuelle.')


def respondFail(s, id, msg=''):
    _respond(s, id, 1, msg or 'Cette interaction est indisponible dans la situation actuelle.')


def changeStat(stat, val, s, id):
    current_sim = services.active_sim_info()
    sim = current_sim.get_sim_instance()

    if sim is not None:
        archive_data = {}
        cur_stat = get_tunable_instance((sims4.resources.Types.STATISTIC), 'motive_'+stat, exact_match=True)
        tracker = sim.get_tracker(cur_stat)
        if tracker is not None:
            cur_value = tracker.get_value(cur_stat)
            if val == "min":
                val = cur_stat.min_value
            if val == "max":
                val = cur_stat.max_value
            if val == "50":
                val = cur_stat.min_value + (cur_stat.max_value - cur_stat.min_value) / 2.0
            if val == "25":
                val = cur_stat.min_value + (cur_stat.max_value - cur_stat.min_value) / 4.0
            if val == "75":
                val = cur_stat.min_value + 3 * (cur_stat.max_value - cur_stat.min_value) / 4.0

            tracker.set_value(cur_stat, val)
            respondSuccess(s, id)

        else:
            respondRetry(s, id)
    else:
        respondRetry(s, id)


def show_notification(text, title=None):
    # We need the client to get the active sim for the icon
    if not toast:
        return

    if len(dialogs)>=5:
        dialog = dialogs.pop(0)
        services.ui_dialog_service().dialog_cancel(dialog)



    client = services.client_manager().get_first_client()
    # If no title was given, use a default
    if title is None:
        title = "Example Title"
    # Convert the strings to raw_text localized strings
    localized_title = lambda **_: LocalizationHelperTuning.get_raw_text(title)
    localized_text = lambda **_: LocalizationHelperTuning.get_raw_text(text)
    urgency = UiDialogNotification.UiDialogNotificationUrgency.DEFAULT
    information_level = UiDialogNotification.UiDialogNotificationLevel.PLAYER
    visual_type = UiDialogNotification.UiDialogNotificationVisualType.INFORMATION
    # Prepare and show the notification

    notification = UiDialogNotification.TunableFactory().default(None, text=localized_text, title=localized_title,
                                                                 urgency=urgency, information_level=information_level,
                                                                 visual_type=visual_type)
    dialogs.append(notification.dialog_id)
    notification.show_dialog(icon_override=IconInfoData(obj_instance=client.active_sim))

def increase_skill(name, sim_info):
    skill = get_skill(name, sim_info)

    if skill == None:
        return False

    value = skill.get_value()
    if value > 90000:
        return False

    skill.set_value(value+2500)
    return True

def decrease_skill(name, sim_info):
    skill = get_skill(name, sim_info)

    if skill == None:
        return False

    value = skill.get_value()
    if value < 500:
        return False

    if value < 2500:
        value = 2500

    skill.set_value(value-2500)
    return True


def get_tag(name):
    if name=='toilet':
        return [181]
    if name=='sink':
        return [180,182]
    if name=='shower':
        return [183,184]
    if name=='fridge':
        return [189]
    if name=='stove':
        return [187]
    if name=='tv':
        return [161,164]
    if name=='computer':
        return [162]
    return -1


def get_skill(name, sim_info):
    id = 0

    if name=='charisma':
        id = 16699
    if name=='comedy':
        id = 16698
    if name=='cooking':
        id = 16705
    if name=='fishing':
        id = 39397
    if name=='fitness':
        id = 16659
    if name=='gardening':
        id = 16700
    if name=='gourmet':
        id = 16701
    if name=='guitar':
        id = 16702
    if name=='handiness':
        id = 16704
    if name=='logic':
        id = 16706
    if name=='mischief':
        id = 16707
    if name=='mixology':
        id = 16695
    if name=='painting':
        id = 16708
    if name=='piano':
        id = 16709
    if name=='photography':
        id = 105774
    if name=='programming':
        id = 16703
    if name=='rocketscience':
        id = 16710
    if name=='videogaming':
        id = 16712
    if name=='violin':
        id = 16713
    if name=='writing':
        id = 16714

    if id==0:
        return None

    stat_manager = services.get_instance_manager(sims4.resources.Types.STATISTIC)

    # We are going for Fitness, I got the ID from the tuning file.
    skill_instance = stat_manager.get(get_resource_key(str(id), sims4.resources.Types.STATISTIC))


    stat = sim_info.get_statistic(skill_instance)
    return stat

def check_sim(sim):
    if sim.species != SpeciesExtended.HUMAN:
        return False
    if not sim.is_simulating:
        return False
    if sim.is_dying:
        return False
    return True

def check_sim_home(sim):
    if sim.species != SpeciesExtended.HUMAN:
        return False
    if not sim.is_simulating:
        return False
    if sim.is_dying:
        return False
    if not sim._sim_info.lives_here:
        return False
    return True

def check_sim_busy(sim):
    if sim.species != SpeciesExtended.HUMAN:
        return False
    if not sim.is_simulating:
        return False
    if sim.is_dying:
        return False

    if sim._sim_info.career_tracker is not None:
        for career in sim._sim_info.careers.values():
            if career.currently_at_work:
                return False

    return True

def check_home_lot(zone, sim):
    return sim.household.home_zone_id == zone.id

def dev_create_sims(cls, sim_creators, pronouns = "",household=None, tgt_client=None, generate_deterministic_sim=False, sim_position: sims4.math.Vector3=None, sim_spawner_tags=None, account=None, is_debug=False, skip_offset=False, additional_fgl_search_flags=None, instantiate=True, creation_source: str='Unknown - create_sims', household_change_origin=HouseholdChangeOrigin.UNKNOWN):
    sim_info_list, _ = cls.create_sim_infos(sim_creators, household=household, starting_funds=0,
      tgt_client=tgt_client,
      account=account,
      generate_deterministic_sim=generate_deterministic_sim,
      zone_id=0,
      creation_source=creation_source,
      household_change_origin=household_change_origin)
    if not instantiate:
        return
    offset = 0.0
    for sim_info in sim_info_list:
        if pronouns != "":
            sim_info.packed_pronouns = pronouns
        if sim_position is not None:
            sim_position = (sims4.math.Vector3)(*sim_position)
            sim_position.x += offset
            if not skip_offset:
                offset = 2.0
            sim_position.y = terrain.get_terrain_height(sim_position.x, sim_position.z)
        if is_debug:
            services.get_zone_situation_manager().add_debug_sim_id(sim_info.id)
        cls.spawn_sim(sim_info, sim_position, sim_spawner_tags=sim_spawner_tags, additional_fgl_search_flags=additional_fgl_search_flags,
          is_debug=is_debug)
        client = services.client_manager().get_client_by_household_id(sim_info.household_id)
        if client is not None:
            client.add_selectable_sim_info(sim_info)
